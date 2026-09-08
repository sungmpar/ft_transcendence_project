import { performance } from 'perf_hooks';
import { mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { GameService } from '../src/game/game.service';
import { isReadyMessage, isSnapshot, ReadyMessage, Snapshot } from '../../shared/protocol';
import { SnapshotBuffer } from '../../frontend/src/arcade/snapshot-buffer';
import { OnlineFixture, startOnlineFixture, connectFixtureClient, nextEvent, waitForFixture } from './online-fixture';

const output = resolve(__dirname, '../../docs/arcade-upgrade/measurements');
const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));
function distribution(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return { count: sorted.length, mean: sorted.reduce((sum, n) => sum + n, 0) / (sorted.length || 1),
    p50: sorted[Math.floor((sorted.length - 1) * .5)] ?? null,
    p95: sorted[Math.ceil((sorted.length - 1) * .95)] ?? null,
    max: sorted[sorted.length - 1] ?? null };
}

describe('measured real Socket.IO transport with separately labeled application delay', () => {
  let fixture: OnlineFixture;
  beforeAll(async () => { fixture = await startOnlineFixture(); }, 30000);
  afterAll(async () => { if (fixture) await fixture.close(); });
  it('records actual input ACK, immediate probe RTT, delayed application RTT and payload volume', async () => {
    mkdirSync(output, { recursive: true });
    const runs: any[] = [];
    for (const addedRoundTripMs of [0, 100, 200]) {
      for (let repetition = 1; repetition <= 3; repetition++) {
        const users = await Promise.all([fixture.createPlayer(), fixture.createPlayer()]);
        const sockets = users.map((user) => fixture.client(user));
        await Promise.all(sockets.map(connectFixtureClient));
        const readyPromises = sockets.map((socket) => nextEvent<ReadyMessage>(socket, 'ready'));
        sockets.forEach((socket) => socket.emit('matchmaking', { mode: false }));
        const ready = await Promise.all(readyPromises);
        expect(ready.every(isReadyMessage)).toBe(true);
        const start = performance.now();
        const timers = new Set<ReturnType<typeof setTimeout>>();
        const intervals: ReturnType<typeof setInterval>[] = [];
        const observations = sockets.map(() => ({ inputs: 0, inputPayloadBytes: 0, snapshots: 0,
          snapshotPayloadBytes: 0, probeRttMs: [] as number[], delayedProbeRttMs: [] as number[],
          inputAckMs: [] as number[], arrivalsMs: [] as number[], bufferDepth: [] as number[],
          displayDelayMs: [] as number[], buffer: new SnapshotBuffer(), pending: new Map<number, number>(),
          sequence: 0, probeSequence: 0 }));
        const later = (delay: number, callback: () => void) => {
          const timer = setTimeout(() => { timers.delete(timer); callback(); }, delay); timers.add(timer);
        };
        sockets.forEach((socket, index) => {
          const observed = observations[index];
          socket.on('snapshot', (snapshot: Snapshot) => {
            if (!isSnapshot(snapshot) || snapshot.matchId !== ready[index].roomId) return;
            observed.snapshots++; observed.snapshotPayloadBytes += Buffer.byteLength(JSON.stringify(snapshot));
            // Capture immutable wire data before delaying the application delivery.
            const captured = JSON.parse(JSON.stringify(snapshot)) as Snapshot;
            later(addedRoundTripMs / 2, () => {
              const now = performance.now();
              observed.arrivalsMs.push(now - start);
              observed.buffer.receive(captured, now - start);
              const ack = captured.ack[ready[index].side as 'left' | 'right'];
              const sent = observed.pending.get(ack);
              if (sent !== undefined && now - start >= 1000) observed.inputAckMs.push(now - sent);
              for (const seq of observed.pending.keys()) if (seq <= ack) observed.pending.delete(seq);
            });
          });
          const input = () => {
            const elapsed = performance.now() - start;
            const packet = { v: 1, matchId: ready[index].roomId, generation: ready[index].generation,
              seq: ++observed.sequence, actionId: 0, up: Math.floor(elapsed / 800) % 2 === 0,
              down: Math.floor(elapsed / 800) % 2 !== 0 };
            observed.pending.set(packet.seq, performance.now());
            later(addedRoundTripMs / 2, () => {
              observed.inputs++; observed.inputPayloadBytes += Buffer.byteLength(JSON.stringify(packet));
              socket.emit('keyboardEvent', packet);
            });
          };
          const probe = () => {
            const nonce = ++observed.probeSequence;
            const requested = performance.now();
            later(addedRoundTripMs / 2, () => {
              const sent = performance.now();
              socket.emit('latencyProbe', { nonce }, (ack: { nonce: number }) => {
                if (ack?.nonce !== nonce) return;
                const arrived = performance.now();
                if (requested - start >= 1000) observed.probeRttMs.push(arrived - sent);
                later(addedRoundTripMs / 2, () => {
                  if (requested - start >= 1000) observed.delayedProbeRttMs.push(performance.now() - requested);
                });
              });
            });
          };
          input(); probe();
          intervals.push(setInterval(input, 100), setInterval(probe, 1200), setInterval(() => {
            const now = performance.now() - start;
            observed.buffer.display(now);
            if (now >= 1000) {
              observed.bufferDepth.push(observed.buffer.metrics.depth);
              observed.displayDelayMs.push(observed.buffer.metrics.displayDelayMs);
            }
          }, 1000 / 60));
        });
        await sleep(5400);
        intervals.forEach(clearInterval);
        await sleep(addedRoundTripMs + 50);
        timers.forEach(clearTimeout); timers.clear();
        const service = fixture.app.get(GameService) as any;
        const room = service.rooms.get(ready[0].roomId);
        const serverMetrics = room ? { ...room.runner.metrics, tick: room.runner.state.tick } : null;
        const clients = observations.map(({ buffer, pending, ...raw }) => ({ ...raw, buffer: buffer.metrics,
          probeRtt: distribution(raw.probeRttMs), delayedProbeRtt: distribution(raw.delayedProbeRttMs),
          inputAck: distribution(raw.inputAckMs), displayDelay: distribution(raw.displayDelayMs) }));
        clients.forEach((client) => {
          expect(client.snapshots).toBeGreaterThan(50);
          expect(client.probeRtt.count).toBeGreaterThanOrEqual(3);
          expect(client.inputAck.count).toBeGreaterThan(20);
        });
        runs.push({ addedRoundTripMs, repetition, seed: Number(ready[0].roomId),
          elapsedMs: performance.now() - start, serverMetrics, clients });
        socketEnd(sockets);
        await waitForFixture(async () => service.rooms.size, (count) => count === 0);
        sockets.forEach((socket) => { socket.disconnect(); socket.removeAllListeners(); });
      }
    }
    const report = { status: 'PASS', measuredAt: new Date().toISOString(), node: process.version,
      platform: process.platform, architecture: process.arch, warmupMs: 1000, observationMs: 4400,
      repetitions: 3, simulationHz: 60, nominalSnapshotHz: 20,
      protocolHash: createHash('sha256').update(readFileSync(resolve(__dirname, '../../shared/protocol.ts'))).digest('hex'),
      method: 'Actual Nest/Socket.IO/JWT/disposable PostgreSQL. Application timers delay input/probe send and snapshot/probe delivery by half the nominal added round trip. Immediate echo RTT measured separately with one monotonic clock. No OS/TCP packet impairment. Node display sampler, not browser rendering or optical latency.',
      input: '100ms legal held-state refresh; 800ms up/down alternating; mode Classic; per-match generated-ID seed recorded. Different seeds mean these are transport observations, not a position/physics comparison.',
      bytes: 'Serialized input and snapshot JSON payload bytes only; excludes Socket.IO/WebSocket/TCP/TLS framing and probes.', runs };
    writeFileSync(resolve(output, 'real-socket-runs.json'), JSON.stringify(report, null, 2));
    const rows = ['addedRoundTripMs,repetition,client,snapshots,snapshotPayloadBytes,inputMessages,inputPayloadBytes,probeRttP50Ms,probeRttP95Ms,delayedProbeP95Ms,inputAckP95Ms,underflows,serverTicks,droppedMs'];
    for (const run of runs) run.clients.forEach((client: any, index: number) => rows.push([
      run.addedRoundTripMs, run.repetition, index + 1, client.snapshots, client.snapshotPayloadBytes,
      client.inputs, client.inputPayloadBytes, client.probeRtt.p50, client.probeRtt.p95,
      client.delayedProbeRtt.p95, client.inputAck.p95, client.buffer.underflowCount,
      run.serverMetrics?.tick, run.serverMetrics?.droppedMs,
    ].join(',')));
    writeFileSync(resolve(output, 'real-socket-summary.csv'), rows.join('\n') + '\n');
  }, 115000);
});
function socketEnd(sockets: any[]) { sockets[0].emit('end'); }
