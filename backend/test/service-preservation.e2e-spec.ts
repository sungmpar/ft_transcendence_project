import { resolve } from 'path';
import request = require('supertest');
import { EmailService } from '../src/auth/email.service';
import { Channel } from '../src/chat/entity/channel.entity';
import { Message } from '../src/chat/entity/message.entity';
import { User } from '../src/user/entity/user.entity';
import { MatchService } from '../src/user/match.service';
import { connectFixtureClient, nextEvent, OnlineFixture, startOnlineFixture, waitForFixture } from './online-fixture';

describe('preserved services against disposable PostgreSQL and real HTTP/Socket.IO', () => {
  let fixture: OnlineFixture;
  let quietLegacyLogs: jest.SpyInstance;
  let mail: jest.SpyInstance;
  const previous = new Map<string, string | undefined>();

  beforeAll(async () => {
    for (const key of ['ENABLE_GUEST_LOGIN', 'DEFAULT_IMG', 'FRONT_URL']) previous.set(key, process.env[key]);
    process.env.ENABLE_GUEST_LOGIN = 'false';
    process.env.DEFAULT_IMG = resolve(__dirname, '../profiles/default.jpeg');
    process.env.FRONT_URL = 'http://127.0.0.1:4173';
    // Existing chat handlers log user identifiers. Keep fixture identities out of evidence.
    quietLegacyLogs = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    fixture = await startOnlineFixture({ includeServices: true });
    mail = jest.spyOn(fixture.app.get(EmailService), 'sendJoinMail');
  });

  afterAll(async () => {
    await fixture?.close();
    quietLegacyLogs?.mockRestore();
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('keeps protected profile and friends endpoints unauthorized without JWT', async () => {
    for (const path of ['/user/me', '/user/friends', '/user/image/me']) {
      const response = await request(fixture.httpUrl).get(path);
      expect(response.status).toBe(401);
    }
  });

  it('preserves guest flag off/on, issued cookie, profile, profile image and friends', async () => {
    const users = fixture.dataSource.getRepository(User);
    const before = await users.count();
    const disabled = await request(fixture.httpUrl).get('/auth/guest').redirects(0);
    expect(disabled.status).toBe(403);
    expect(await users.count()).toBe(before);

    process.env.ENABLE_GUEST_LOGIN = 'true';
    const enabled = await request(fixture.httpUrl).get('/auth/guest').redirects(0);
    expect(enabled.status).toBe(302);
    expect(enabled.headers.location === 'http://127.0.0.1:4173/login?token=check').toBe(true);
    const cookies = enabled.headers['set-cookie'] as string[] | undefined;
    const token = cookies?.find((cookie) => cookie.startsWith('token='))?.match(/^token=([^;]+)/)?.[1];
    expect(Boolean(token)).toBe(true);
    const authorized = () => ({ Authorization: `Bearer ${decodeURIComponent(token || '')}` });
    const profile = await request(fixture.httpUrl).get('/user/me').set(authorized());
    expect(profile.status).toBe(200);
    expect(Number.isSafeInteger(profile.body.id)).toBe(true);
    expect(/^g[a-z0-9]{7}$/.test(profile.body.name) && profile.body.nickname === profile.body.name).toBe(true);
    expect(await users.count()).toBe(before + 1);
    const image = await request(fixture.httpUrl).get('/user/image/me').set(authorized());
    expect(image.status).toBe(200);
    expect(Buffer.isBuffer(image.body) && image.body.length > 0).toBe(true);
    const friends = await request(fixture.httpUrl).get('/user/friends').set(authorized());
    expect(friends.status).toBe(200);
    expect(Array.isArray(friends.body) && friends.body.length === 0).toBe(true);
    expect(mail).not.toHaveBeenCalled();
  });

  it('preserves profile edits, friend persistence and the unmet-2FA HTTP guard', async () => {
    const player = await fixture.createPlayer();
    const friend = await fixture.createPlayer();
    const headers = { Authorization: `Bearer ${fixture.browserCredential(player)}` };
    const nickname = await request(fixture.httpUrl).patch('/user/nickname').set(headers).send({ nickname: 'SmokeUser' });
    expect(nickname.status).toBe(200);
    const added = await request(fixture.httpUrl).patch('/user/friends').set(headers).send({ id: friend.id });
    expect(added.status).toBe(200);
    const friends = await request(fixture.httpUrl).get('/user/friends').set(headers);
    expect(friends.status).toBe(200);
    expect(friends.body.some((value: { id: number }) => value.id === friend.id)).toBe(true);
    const persisted = await fixture.dataSource.getRepository(User).findOneByOrFail({ id: player.id });
    expect(persisted.nickname === 'SmokeUser' && persisted.friends.includes(friend.id)).toBe(true);

    const enabled = await request(fixture.httpUrl).patch('/user/need2fa').set(headers).send({ value: true });
    expect(enabled.status).toBe(200);
    expect((await request(fixture.httpUrl).get('/user/me').set(headers)).status).toBe(403);
    const disabled = await request(fixture.httpUrl).patch('/user/need2fa').set(headers).send({ value: false });
    expect(disabled.status).toBe(200);
    expect((await request(fixture.httpUrl).get('/user/me').set(headers)).status).toBe(200);
    expect(mail).not.toHaveBeenCalled();
  });

  it('authenticates two real chat clients and persists channel join, messages and leave', async () => {
    const rejected = fixture.client(undefined, 'missing', 'chat');
    const denied = nextEvent(rejected, 'connect_error');
    rejected.connect();
    await denied;
    expect(rejected.connected).toBe(false);
    rejected.disconnect();

    const first = await fixture.createPlayer(), second = await fixture.createPlayer();
    const left = fixture.client(first, 'valid', 'chat'), right = fixture.client(second, 'valid', 'chat');
    const initialLeft = nextEvent(left, 'channel-list'), initialRight = nextEvent(right, 'channel-list');
    await Promise.all([connectFixtureClient(left), connectFixtureClient(right)]);
    await Promise.all([initialLeft, initialRight]);
    const created = nextEvent<Array<{ id: number }>>(left, 'channel-list');
    // Production ValidationPipe checks this field even for a public channel.
    left.emit('create', { name: 'SmokeRoom', password: 'Fixture123', isPrivate: false });
    const channels = await created;
    expect(channels.length).toBe(1);
    const channelId = channels[0].id;
    const joined = nextEvent<Array<{ id: number }>>(right, 'channel-list');
    right.emit('join', { id: channelId, password: 'Fixture123', isPrivate: false });
    expect((await joined).some((channel) => channel.id === channelId)).toBe(true);
    await waitForFixture(() => fixture.dataSource.getRepository(Channel).findOne({
      where: { id: channelId }, relations: ['users'],
    }), (channel) => channel?.users.length === 2);

    const text = 'fixture service preservation message';
    // Join notifications also use the message event; select the actual sent content.
    const received = new Promise<{ channel: number; message: string; userId: number }>((resolve, reject) => {
      const timeout = setTimeout(() => { right.off('message', listener); reject(new Error('Chat fixture message timed out')); }, 5000);
      const listener = (value: { channel: number; message: string; userId: number }) => {
        if (value.message !== text) return;
        clearTimeout(timeout); right.off('message', listener); resolve(value);
      };
      right.on('message', listener);
    });
    left.emit('message', { channel: channelId, message: text });
    const actual = await received;
    expect(actual.channel === channelId && actual.userId === first.id).toBe(true);
    const messages = await fixture.dataSource.getRepository(Message).find({ where: { message: text } });
    expect(messages.length).toBe(1);
    expect(messages[0].user.id === first.id).toBe(true);
    const history = nextEvent<{ messages: Array<{ message: string }> }>(right, 'all-message');
    right.emit('all-message', channelId);
    expect((await history).messages.some((value) => value.message === text)).toBe(true);

    const leftChannel = nextEvent(right, 'leave');
    right.emit('leave', channelId);
    await leftChannel;
    const remaining = await waitForFixture(() => fixture.dataSource.getRepository(Channel).findOne({
      where: { id: channelId }, relations: ['users'],
    }), (channel) => channel?.users.length === 1);
    expect(remaining.users[0].id === first.id).toBe(true);
    left.disconnect(); right.disconnect();
    expect(mail).not.toHaveBeenCalled();
  });

  it('keeps match history available while an unfinalized match exists', async () => {
    const player = await fixture.createPlayer(), friend = await fixture.createPlayer();
    await fixture.app.get(MatchService).create(player, friend);
    const response = await request(fixture.httpUrl).get('/user/match')
      .set({ Authorization: `Bearer ${fixture.browserCredential(player)}` });
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });
});
