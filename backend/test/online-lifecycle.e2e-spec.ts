import { Socket } from '../../frontend/node_modules/socket.io-client';
import { isReadyMessage, ReadyMessage, Snapshot } from '../../shared/protocol';
import { MatchService } from '../src/user/match.service';
import { Match } from '../src/user/entity/match.entity';
import { User } from '../src/user/entity/user.entity';
import { GameService } from '../src/game/game.service';
import { UserService } from '../src/user/user.service';
import {
  connectFixtureClient,
  nextEvent,
  OnlineFixture,
  startOnlineFixture,
  waitForFixture,
} from './online-fixture';

function snapshotWhere(
  socket: Socket,
  accept: (snapshot: Snapshot) => boolean,
): Promise<Snapshot> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off('snapshot', receive);
      reject(new Error('Snapshot condition timed out'));
    }, 5000);
    const receive = (snapshot: Snapshot) => {
      if (!accept(snapshot)) return;
      clearTimeout(timer);
      socket.off('snapshot', receive);
      resolve(snapshot);
    };
    socket.on('snapshot', receive);
  });
}

describe('real PostgreSQL result transactions and Socket.IO lifecycle', () => {
  let fixture: OnlineFixture;
  beforeAll(async () => {
    fixture = await startOnlineFixture();
  }, 30000);
  afterAll(async () => {
    if (fixture) await fixture.close();
  }, 15000);

  it('uses unique real IDs for concurrent creation and after deletion', async () => {
    const players = await Promise.all(
      Array.from({ length: 4 }, () => fixture.createPlayer()),
    );
    const matches = fixture.app.get(MatchService);
    const created = await Promise.all([
      matches.create(players[0], players[1]),
      matches.create(players[2], players[3]),
    ]);
    expect(created[0].id).not.toBe(created[1].id);
    await matches.delete(String(created[0].id));
    const next = await matches.create(players[0], players[1]);
    expect(next.id).toBeGreaterThan(Math.max(created[0].id, created[1].id));
  });

  it('commits concurrent wins and duplicate requests once with atomic nonduplicate achievements', async () => {
    const players = await Promise.all(
      Array.from({ length: 4 }, () => fixture.createPlayer()),
    );
    const matches = fixture.app.get(MatchService);
    const created = await Promise.all(
      players.slice(1).map((other) => matches.create(players[0], other)),
    );
    const outcomes = created.map((match, index) => ({
      id: String(match.id),
      result: {
        winner: players[0],
        loser: players[index + 1],
        winnerScore: 6,
        loserScore: index,
      },
    }));
    await Promise.all(
      outcomes.flatMap((outcome) =>
        Array.from({ length: 3 }, () =>
          matches.update(outcome.id, outcome.result),
        ),
      ),
    );
    const winner = await fixture.dataSource
      .getRepository(User)
      .findOne({ where: { id: players[0].id }, relations: ['won'] });
    expect(winner.won).toHaveLength(3);
    expect(
      winner.achievement.filter((value) => value === 'first win'),
    ).toHaveLength(1);
    expect(
      winner.achievement.filter((value) => value === 'third win'),
    ).toHaveLength(1);
    expect(
      winner.achievement.filter((value) => value === 'perfect win'),
    ).toHaveLength(1);
    await expect(
      matches.update(outcomes[0].id, {
        winner: players[1],
        loser: players[0],
        winnerScore: 6,
        loserScore: 1,
      }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('pauses short disconnects, resynchronizes new generations, rejects another active tab, and preserves spectators', async () => {
    const users = await Promise.all(
      Array.from({ length: 3 }, () => fixture.createPlayer()),
    );
    const left = fixture.client(users[0]);
    const right = fixture.client(users[1]);
    const spectator = fixture.client(users[2]);
    await Promise.all([left, right, spectator].map(connectFixtureClient));
    const readies = [
      nextEvent<ReadyMessage>(left, 'ready'),
      nextEvent<ReadyMessage>(right, 'ready'),
    ];
    left.emit('matchmaking', { mode: false });
    right.emit('matchmaking', { mode: false });
    const [originalLeft, originalRight] = await Promise.all(readies);
    expect(originalRight.snapshot.instanceId).toBe(originalLeft.snapshot.instanceId);
    expect(originalRight.snapshot.clockEpoch).toBe(originalLeft.snapshot.clockEpoch);
    const spectatorInitial = nextEvent<ReadyMessage>(spectator, 'setData');
    spectator.emit('spectate', { id: originalLeft.roomId });
    const originalSpectator = await spectatorInitial;
    const input = {
      v: 1,
      matchId: originalLeft.roomId,
      generation: originalLeft.generation,
      seq: 1,
      up: true,
      down: false,
      actionId: 0,
    };
    const applied = snapshotWhere(right, (snapshot) => snapshot.ack.left === 1);
    left.emit('keyboardEvent', input);
    await applied;
    let last: Snapshot;
    right.on('snapshot', (snapshot) => {
      last = snapshot;
    });
    const waiting = nextEvent<{ status: string; graceMs: number }>(
      right,
      'sessionStatus',
    );
    left.disconnect();
    expect(await waiting).toMatchObject({ status: 'waiting', graceMs: 5000 });
    const pausedTick = last.tick;
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(last.tick).toBe(pausedTick);
    const resumedLeft = fixture.client(users[0]);
    const restored = [
      nextEvent<ReadyMessage>(resumedLeft, 'ready'),
      nextEvent<ReadyMessage>(right, 'ready'),
    ];
    const spectatorRestored = nextEvent<ReadyMessage>(spectator, 'setData');
    await connectFixtureClient(resumedLeft);
    const [newLeft, newRight] = await Promise.all(restored);
    expect(isReadyMessage(newLeft)).toBe(true);
    expect(newLeft.generation).toBeGreaterThan(originalLeft.generation);
    expect(newRight.generation).toBeGreaterThan(originalRight.generation);
    expect(newLeft.snapshot.tick).toBe(pausedTick);
    expect(newLeft.snapshot.instanceId).toBe(originalLeft.snapshot.instanceId);
    expect(newLeft.snapshot.clockEpoch).toBeGreaterThan(originalLeft.snapshot.clockEpoch);
    expect(newRight.snapshot.clockEpoch).toBe(newLeft.snapshot.clockEpoch);
    const resyncedSpectator = await spectatorRestored;
    expect(resyncedSpectator.generation).toBeGreaterThan(
      originalSpectator.generation,
    );
    expect(resyncedSpectator.snapshot.tick).toBe(pausedTick);
    expect(resyncedSpectator.snapshot.instanceId).toBe(newLeft.snapshot.instanceId);
    expect(resyncedSpectator.snapshot.clockEpoch).toBe(newLeft.snapshot.clockEpoch);
    const oldRejected = snapshotWhere(
      right,
      (snapshot) => snapshot.tick > pausedTick,
    );
    resumedLeft.emit('keyboardEvent', input);
    expect((await oldRejected).ack.left).toBe(0);
    const accepted = snapshotWhere(
      right,
      (snapshot) => snapshot.ack.left === 1,
    );
    resumedLeft.emit('keyboardEvent', {
      ...input,
      generation: newLeft.generation,
      up: false,
      down: true,
    });
    await accepted;
    const anotherTab = fixture.client(users[0]);
    const rejected = nextEvent<{ message: string }>(anotherTab, 'error');
    anotherTab.connect();
    expect((await rejected).message).toContain('이미 연결된 게임 세션');
    await waitForFixture(
      async () => anotherTab.connected,
      (connected) => !connected,
    );
    const spectatorReady = nextEvent<ReadyMessage>(spectator, 'setData');
    spectator.emit('spectate', { id: newLeft.roomId });
    const visible = await spectatorReady;
    expect(isReadyMessage(visible)).toBe(true);
    expect(visible.side).toBe('spectator');
    const next = snapshotWhere(
      right,
      (snapshot) => snapshot.tick > visible.snapshot.tick,
    );
    spectator.emit('keyboardEvent', {
      ...input,
      generation: newLeft.generation,
      seq: 2,
    });
    expect((await next).ack.left).toBe(1);
    const ended = [nextEvent(right, 'matchEnded'), nextEvent(spectator, 'matchEnded')];
    resumedLeft.emit('end');
    expect(await Promise.all(ended)).toEqual([1, 2].map(() => ({ v: 1, roomId: newLeft.roomId, winner: 'right' })));
    [resumedLeft, right, spectator].forEach((client) => client.disconnect());
  }, 15000);

  it('expires the real five-second grace and stores one disconnect result', async () => {
    const users = await Promise.all([
      fixture.createPlayer(),
      fixture.createPlayer(),
    ]);
    const [left, right] = users.map((user) => fixture.client(user));
    await Promise.all([left, right].map(connectFixtureClient));
    const readies = [
      nextEvent<ReadyMessage>(left, 'ready'),
      nextEvent<ReadyMessage>(right, 'ready'),
    ];
    left.emit('matchmaking', { mode: false });
    right.emit('matchmaking', { mode: false });
    const [ready] = await Promise.all(readies);
    const ended = nextEvent(right, 'matchEnded', 8000);
    const before = Date.now();
    left.disconnect();
    expect(await ended).toMatchObject({ v: 1, roomId: ready.roomId, winner: 'right' });
    expect(Date.now() - before).toBeGreaterThanOrEqual(4900);
    const stored = await fixture.dataSource
      .getRepository(Match)
      .findOne({ where: { id: Number(ready.roomId) } });
    expect(stored.winner.id).toBe(users[1].id);
    expect(stored.winnerScore).toBe(0);
    right.disconnect();
  }, 12000);

  it('rolls back a real database failure then retries the same result without duplicate achievements', async () => {
    const schema = fixture.dataSource.getMetadata(Match).schema;
    if (!/^arcade_[0-9a-f]{16}$/.test(schema))
      throw new Error('Unexpected fixture schema');
    const users = await Promise.all([
      fixture.createPlayer(),
      fixture.createPlayer(),
    ]);
    const [left, right] = users.map((user) => fixture.client(user));
    await Promise.all([left, right].map(connectFixtureClient));
    const readies = [
      nextEvent<ReadyMessage>(left, 'ready'),
      nextEvent<ReadyMessage>(right, 'ready'),
    ];
    left.emit('matchmaking', { mode: false });
    right.emit('matchmaking', { mode: false });
    const [ready] = await Promise.all(readies);
    await fixture.dataSource.query(
      `ALTER TABLE "${schema}"."Match" ADD CONSTRAINT fixture_reject_result CHECK ("winnerScore" IS NULL) NOT VALID`,
    );
    try {
      const retrying = nextEvent<{ status: string; attempt: number }>(
        right,
        'resultStatus',
      );
      const ended = nextEvent(right, 'matchEnded', 6000);
      left.emit('end');
      expect(await retrying).toMatchObject({ status: 'retrying', attempt: 1 });
      const beforeRetry = await fixture.dataSource
        .getRepository(Match)
        .findOne({ where: { id: Number(ready.roomId) } });
      const beforeWinner = await fixture.dataSource
        .getRepository(User)
        .findOne({ where: { id: users[1].id } });
      expect(beforeRetry.winner).toBeNull();
      expect(beforeWinner.achievement).toEqual([]);
      await fixture.dataSource.query(
        `ALTER TABLE "${schema}"."Match" DROP CONSTRAINT fixture_reject_result`,
      );
      expect(await ended).toMatchObject({ v: 1, roomId: ready.roomId, winner: 'right' });
      const after = await fixture.dataSource
        .getRepository(User)
        .findOne({ where: { id: users[1].id }, relations: ['won'] });
      expect(after.won).toHaveLength(1);
      expect(
        after.achievement.filter((value) => value === 'first win'),
      ).toHaveLength(1);
      for (let i = 0; i < 10; i++) right.emit('achievement');
      const echoed = await new Promise<{ nonce: number }>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error('Latency probe acknowledgement timed out')),
          2000,
        );
        right.emit('latencyProbe', { nonce: 1 }, (reply) => {
          clearTimeout(timer);
          resolve(reply);
        });
      });
      expect(echoed.nonce).toBe(1);
      const unchanged = await fixture.dataSource
        .getRepository(User)
        .findOne({ where: { id: users[1].id } });
      expect(unchanged.achievement).toEqual(after.achievement);
    } finally {
      await fixture.dataSource.query(
        `ALTER TABLE "${schema}"."Match" DROP CONSTRAINT IF EXISTS fixture_reject_result`,
      );
      [left, right].forEach((client) => client.disconnect());
    }
  }, 12000);

  it('resolves an injected lost post-commit response by reading the real committed result on retry', async () => {
    const users = await Promise.all([
      fixture.createPlayer(),
      fixture.createPlayer(),
    ]);
    const [left, right] = users.map((user) => fixture.client(user));
    await Promise.all([left, right].map(connectFixtureClient));
    const readies = [
      nextEvent<ReadyMessage>(left, 'ready'),
      nextEvent<ReadyMessage>(right, 'ready'),
    ];
    left.emit('matchmaking', { mode: false });
    right.emit('matchmaking', { mode: false });
    const [ready] = await Promise.all(readies);
    const manager = fixture.dataSource.manager;
    const originalTransaction = manager.transaction.bind(manager);
    let loseReply = true;
    // Fault injection at the application/driver-return boundary, not a claim of
    // actual TCP packet loss: each underlying PostgreSQL transaction is real.
    const responseFault = jest
      .spyOn(manager, 'transaction')
      .mockImplementation((async (...args: any[]) => {
        const result = await (originalTransaction as any)(...args);
        if (loseReply) {
          loseReply = false;
          throw new Error('fixture lost post-commit response');
        }
        return result;
      }) as any);
    try {
      const retrying = nextEvent<{ status: string }>(right, 'resultStatus');
      const ended = nextEvent(right, 'matchEnded', 6000);
      left.emit('end');
      expect((await retrying).status).toBe('retrying');
      const committed = await fixture.dataSource
        .getRepository(Match)
        .findOne({ where: { id: Number(ready.roomId) } });
      expect(committed.winner.id).toBe(users[1].id);
      expect(await ended).toMatchObject({ v: 1, roomId: ready.roomId, winner: 'right' });
      const winner = await fixture.dataSource
        .getRepository(User)
        .findOne({ where: { id: users[1].id }, relations: ['won'] });
      expect(winner.won).toHaveLength(1);
      expect(
        winner.achievement.filter((value) => value === 'first win'),
      ).toHaveLength(1);
      expect(responseFault).toHaveBeenCalledTimes(2);
    } finally {
      responseFault.mockRestore();
      [left, right].forEach((client) => client.disconnect());
    }
  }, 12000);

  it('reports terminal storage failure after three real rollbacks and permits a fresh match', async () => {
    const schema = fixture.dataSource.getMetadata(Match).schema;
    if (!/^arcade_[0-9a-f]{16}$/.test(schema))
      throw new Error('Unexpected fixture schema');
    const users = await Promise.all([
      fixture.createPlayer(),
      fixture.createPlayer(),
    ]);
    const [left, right] = users.map((user) => fixture.client(user));
    await Promise.all([left, right].map(connectFixtureClient));
    const readies = [
      nextEvent<ReadyMessage>(left, 'ready'),
      nextEvent<ReadyMessage>(right, 'ready'),
    ];
    left.emit('matchmaking', { mode: false });
    right.emit('matchmaking', { mode: false });
    const [ready] = await Promise.all(readies);
    await fixture.dataSource.query(
      `ALTER TABLE "${schema}"."Match" ADD CONSTRAINT fixture_terminal_failure CHECK ("winnerScore" IS NULL) NOT VALID`,
    );
    try {
      const statuses: Array<{ status: string; attempt: number }> = [];
      right.on('resultStatus', (status) => statuses.push(status));
      const ended = nextEvent(right, 'matchEnded', 6000);
      left.emit('end');
      expect(await ended).toMatchObject({ v: 1, roomId: ready.roomId, winner: 'right' });
      expect(statuses.map((status) => [status.status, status.attempt])).toEqual(
        [
          ['retrying', 1],
          ['retrying', 2],
          ['failed', 3],
        ],
      );
      const stored = await fixture.dataSource
        .getRepository(Match)
        .findOne({ where: { id: Number(ready.roomId) } });
      expect(stored.winner).toBeNull();
      await expect(
        fixture.app.get(UserService).fetchMatch(users[0]),
      ).resolves.toMatchObject({ match: [] });
      const game = fixture.app.get(GameService) as any;
      expect(game.matchByUser.has(users[0].id)).toBe(false);
      expect(game.matchByUser.has(users[1].id)).toBe(false);
      expect(
        game.failedResults.some(
          (result) => result.roomId === ready.roomId && result.attempts === 3,
        ),
      ).toBe(true);
      await fixture.dataSource.query(
        `ALTER TABLE "${schema}"."Match" DROP CONSTRAINT fixture_terminal_failure`,
      );
      const rematch = [
        nextEvent<ReadyMessage>(left, 'ready'),
        nextEvent<ReadyMessage>(right, 'ready'),
      ];
      left.emit('matchmaking', { mode: false });
      right.emit('matchmaking', { mode: false });
      const [next] = await Promise.all(rematch);
      expect(next.roomId).not.toBe(ready.roomId);
      const rematchEnd = nextEvent(left, 'matchEnded');
      right.emit('end');
      expect(await rematchEnd).toMatchObject({ v: 1, roomId: next.roomId, winner: 'left' });
      const history = await fixture.app.get(UserService).fetchMatch(users[0]);
      expect(history.match).toHaveLength(1);
      expect(history.won).toBe(1);
      expect(history.lost).toBe(0);
    } finally {
      await fixture.dataSource.query(
        `ALTER TABLE "${schema}"."Match" DROP CONSTRAINT IF EXISTS fixture_terminal_failure`,
      );
      [left, right].forEach((client) => client.disconnect());
    }
  }, 12000);
});
