'use strict';
// Disposable PostgreSQL + Redis only. No Azure or production credentials are read.
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { Client } = require('pg');
const Redis = require('ioredis');
const { io } = require('../../frontend/node_modules/socket.io-client');
const root = path.resolve(__dirname, '..');
const evidence = process.env.MANAGED_TEST_EVIDENCE || path.resolve(root, '../test-evidence');
fs.mkdirSync(evidence, {recursive: true});
const namespace = `integration_${crypto.randomBytes(6).toString('hex')}`;
const secret = crypto.randomBytes(40).toString('hex');
const dbURL = 'postgresql://migration_test@127.0.0.1:55432/migration_test';
const report = {startedAt: new Date().toISOString(), environment: 'isolated-local-two-instances', checks: [], passed: false};
const children = [], sockets = [], streams = [];
const urls = ['http://127.0.0.1:55001', 'http://127.0.0.1:55002'];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const check = (name, detail = {}) => { report.checks.push({name, passed: true, ...detail}); console.log(`PASS ${name}`); };
function event(socket, name, predicate = () => true, ms = 10000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.off(name, listener); reject(new Error(`Timeout: ${name}`)); }, ms);
    const listener = value => { if (predicate(value)) {clearTimeout(timer); socket.off(name, listener); resolve(value);} };
    socket.on(name, listener);
  });
}
async function until(fn, accept, ms = 10000) {
  const end = Date.now() + ms;
  do {const v = await fn(); if (accept(v)) return v; await sleep(80);} while (Date.now() < end);
  throw new Error('Bounded state wait expired');
}
async function http(base, route, token, init = {}) {
  return fetch(base + route, {...init, redirect: 'manual', headers: {...(token ? {Authorization: `Bearer ${token}`} : {}), ...init.headers}, signal: AbortSignal.timeout(10000)});
}
async function guest(base) {
  const res = await http(base, '/auth/guest'); assert.equal(res.status, 302);
  const cookie = res.headers.getSetCookie().find(v => v.startsWith('token=')); assert.ok(cookie);
  const token = decodeURIComponent(cookie.match(/^token=([^;]+)/)[1]);
  const p = await http(base, '/user/me', token); assert.equal(p.status, 200);
  return {token, user: await p.json()};
}
async function connect(base, who, ns = 'game') {
  const s = io(base + '/' + ns, {transports: ['websocket'], reconnection: false, forceNew: true, autoConnect: false, auth: {token: who.token}, timeout: 10000});
  sockets.push(s);
  const connected = event(s, 'connect');
  const failure = new Promise((_, reject) => s.once('connect_error', () => reject(new Error('Socket authentication/connection failed'))));
  s.connect(); await Promise.race([connected, failure]); return s;
}
const jsonPatch = (body) => ({method: 'PATCH', headers: {'content-type':'application/json'}, body: JSON.stringify(body)});
(async () => {
 const db = new Client({connectionString: dbURL}); const redis = new Redis('redis://127.0.0.1:56379');
 try {
  await db.connect();
  assert.deepEqual((await db.query('SELECT current_database() AS db, current_user AS usr')).rows[0], {db:'migration_test', usr:'migration_test'});
  for (let i = 0; i < 2; i++) {
   const output = fs.openSync(path.join(evidence, `instance-${i}.log`), 'w', 0o600); streams.push(output);
   const env = {PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV:'test', DATABASE_URL:dbURL, REDIS_URL:'redis://127.0.0.1:56379', SECRET:secret, PORT:String(55001+i), FRONT_URL:urls[i], ENABLE_GUEST_LOGIN:'true', GUEST_ALLOW_LOCAL_LOOPBACK:'true', GAME_REDIS_NAMESPACE:namespace, AUTH_REDIS_NAMESPACE:namespace, DEFAULT_IMG:path.resolve(root, '../frontend/public/default.jpeg')};
   children.push(spawn(process.execPath, ['main.js'], {cwd:root, env, stdio:['ignore', output, output]}));
  }
  await Promise.all(urls.map(u => until(async () => {try {return (await http(u, '/health')).status;} catch {return 0;}}, s=>s===200, 25000)));
  check('two isolated compiled NestJS instances start against real PostgreSQL and Redis');
  assert.equal((await http(urls[0], '/user/me')).status, 401);
  const config = await (await http(urls[0], '/auth/config')).json(); assert.deepEqual(config,{guest:true,oauth42:false,email2fa:false});
  const [a,b,c] = await Promise.all([guest(urls[0]),guest(urls[1]),guest(urls[1])]);
  check('guest cookie issuance, authenticated profile and unauthenticated API rejection');
  const publicProfile = await (await http(urls[0], `/user/${b.user.id}`, a.token)).json();
  assert.deepEqual(Object.keys(publicProfile).sort(), ['id','nickname','profileUrl','status'].sort());
  assert.equal((await http(urls[0], '/user/?id=', a.token)).status,400);
  assert.equal((await http(urls[0], '/user/need2fa', a.token, jsonPatch({value:true}))).status,503);
  check('public profile field allowlist and unavailable email 2FA fails closed');
  assert.equal((await http(urls[0], '/user/friends', a.token, jsonPatch({id:b.user.id}))).status,200);
  const friends = await (await http(urls[1], '/user/friends', a.token)).json(); assert.ok(friends.some(v=>v.id===b.user.id));
  check('friend persistence across server instances');
  const sharp = require('sharp');
  const png = await sharp({create:{width:16,height:16,channels:3,background:'#778899'}}).png().toBuffer();
  for (const [data,mime,expected] of [[png,'image/png',201],[Buffer.from('not a png'),'image/png',400]]) {
   const form = new FormData(); form.append('file', new Blob([data],{type:mime}), 'fixture.png');
   const res = await http(urls[0], '/user/upload', a.token, {method:'POST',body:form}); assert.equal(res.status,expected);
  }
  const img = await http(urls[0], '/user/image/me', a.token); assert.equal(img.status,200);
  const decoded = await sharp(Buffer.from(await img.arrayBuffer())).metadata(); assert.equal(decoded.format,'png');
  check('real image upload, decoded re-encoding, retrieval and malformed image rejection');
  const [ca,cb,cc] = await Promise.all([connect(urls[0],a,'chat'),connect(urls[1],b,'chat'),connect(urls[1],c,'chat')]);
  await sleep(300);
  const channelCreated = event(ca,'channel-list',arr=>Array.isArray(arr)&&arr.some(x=>x.name===namespace.slice(-10)));
  ca.emit('create',{name:namespace.slice(-10),password:'Fixture123',isPrivate:false});
  const channels = await channelCreated; const channel = channels.find(x=>x.name===namespace.slice(-10));
  const joined = event(cb,'channel-list',arr=>Array.isArray(arr)&&arr.some(x=>x.id===channel.id));
  cb.emit('join',{id:channel.id,password:'Fixture123',isPrivate:false}); await joined;
  const text = `integration-${namespace}`;
  const received = event(cb,'message',v=>v?.message===text); ca.emit('message',{channel:channel.id,message:text});
  assert.equal((await received).userId,a.user.id);
  const history = event(cb,'all-message',v=>v?.messages?.some(m=>m.message===text)); cb.emit('all-message',channel.id); await history;
  assert.equal(Number((await db.query('SELECT count(*) FROM message WHERE message=$1',[text])).rows[0].count),1);
  check('cross-instance channel creation, joining, messaging and PostgreSQL history');
  const denied = event(cc,'error'); cc.emit('message',{channel:channel.id,message:'unjoined-not-allowed'}); await denied;
  assert.equal(Number((await db.query('SELECT count(*) FROM message WHERE message=$1',['unjoined-not-allowed'])).rows[0].count),0);
  check('non-member cannot send channel messages');
  const dm = `dm-${namespace}`;
  const dmReceived = event(cb,'direct-message',v=>v?.message===dm);
  ca.emit('join-dm',{userId:a.user.id,otherUserId:b.user.id});
  await sleep(150);
  ca.emit('direct-message',{userId:a.user.id,otherUserId:b.user.id,message:dm}); await dmReceived;
  const spoofDenied = event(ca,'error'); ca.emit('direct-message',{userId:b.user.id,otherUserId:c.user.id,message:'spoof-rejected'}); await spoofDenied;
  check('cross-instance direct messages and sender-spoofing rejection');
  const kick = event(ca,'notify'); ca.emit('admin',{channel:channel.id,user:b.user.id,type:'kick'}); await kick;
  let leaked = false; const afterKick='after-kick-'+namespace; cb.on('message',v=>{if(v?.message===afterKick) leaked=true;});
  ca.emit('message',{channel:channel.id,message:afterKick}); await sleep(500); assert.equal(leaked,false);
  check('kicked member does not receive later cross-instance channel traffic');
  ca.disconnect(); cb.disconnect(); cc.disconnect();
  let ga = await connect(urls[0],a), gb = await connect(urls[1],b); const gc = await connect(urls[1],c);
  await sleep(700);
  let ra, rb; const pa = event(ga,'ready'), pb=event(gb,'ready');
  ga.emit('matchmaking',{mode:false}); gb.emit('matchmaking',{mode:false}); [ra,rb]=await Promise.all([pa,pb]);
  assert.equal(ra.roomId,rb.roomId); const matchId=ra.roomId; report.matchId=matchId;
  const spectating=event(gc,'setData',v=>v?.roomId===matchId); gc.emit('spectate',{id:matchId}); await spectating;
  ga.emit('keyboardEvent',{v:1,matchId,generation:ra.generation,seq:1,up:true,down:false,actionId:0});
  await event(ga,'snapshot',s=>s.ack[ra.side]>=1);
  ga.emit('keyboardEvent',{v:1,matchId,generation:ra.generation,seq:2,up:false,down:false,actionId:0});
  check('cross-instance matchmaking, spectating and authoritative keyboard input');
  const waitStatus=event(gb,'sessionStatus',v=>v?.status==='waiting'); ga.disconnect(); await waitStatus;
  ga=await connect(urls[0],a); const resumed=await event(ga,'ready',v=>v?.roomId===matchId); ra=resumed;
  assert.equal(resumed.roomId,matchId); check('transport disconnect reconnect restores same match');
  // Match authority is owned by one of these two test processes. Kill only that exact PID.
  const lease=await redis.get(`ft:game:${namespace}:lease`); assert.ok(lease);
  const owner=lease.split(':')[0]; const aOwner=await redis.get(`ft:game:${namespace}:presence:${ga.id}`);
  const leaderIndex=aOwner===owner?0:1; const survivorIndex=1-leaderIndex;
  const survivor = leaderIndex===0?gb:ga;
  const recovery=event(survivor,'ready',v=>v?.roomId===matchId,18000);
  children[leaderIndex].kill('SIGKILL'); await recovery;
  if(leaderIndex===0){ga=await connect(urls[survivorIndex],a);ra=await event(ga,'ready',v=>v?.roomId===matchId,18000);}
  else{gb=await connect(urls[survivorIndex],b);rb=await event(gb,'ready',v=>v?.roomId===matchId,18000);}
  check('authority process SIGKILL failover preserves match and accepts reconnect', {killedInstance:leaderIndex});
  const done=await until(async()=> (await db.query('SELECT id,"winnerId","loserId","winnerScore","loserScore" FROM "Match" WHERE id=$1',[Number(matchId)])).rows[0],r=>r?.winnerId!=null,90000);
  assert.ok(done.winnerScore>=6); assert.equal(Number((await db.query('SELECT count(*) FROM "Match" WHERE id=$1',[matchId])).rows[0].count),1);
  const statsBefore=(await db.query('SELECT id,ladder,achievement FROM "User" WHERE id=ANY($1::int[]) ORDER BY id',[[a.user.id,b.user.id]])).rows;
  ga.emit('end');gb.emit('end');ga.emit('achievement');gb.emit('achievement');await sleep(600);
  assert.deepEqual((await db.query('SELECT id,ladder,achievement FROM "User" WHERE id=ANY($1::int[]) ORDER BY id',[[a.user.id,b.user.id]])).rows,statsBefore);
  report.result=done;check('completed match persists once and duplicate terminal client events do not double-award');
  report.passed=true;
 } catch(err) {
  report.failure=String(err.message).replace(/Bearer\s+\S+/g,'Bearer [redacted]'); console.error('FAIL',report.failure);process.exitCode=1;
 } finally {
  for(const s of sockets)s.disconnect();
  for(const p of children){if(p.exitCode===null&&!p.killed)p.kill('SIGTERM');}
  await sleep(400);
  for(const p of children){if(p.exitCode===null)p.kill('SIGKILL');}
  for(const fd of streams)try{fs.closeSync(fd);}catch{}
  await redis.quit().catch(()=>redis.disconnect()); await db.end().catch(()=>{});
  report.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(evidence,'managed-integration.json'),JSON.stringify(report,null,2));
 }
})();
