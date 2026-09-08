import { Match } from '../src/user/entity/match.entity';
import {
  isReadyMessage,
  isSnapshot,
  ReadyMessage,
  Snapshot,
} from '../../shared/protocol';
import {
  connectFixtureClient,
  nextEvent,
  OnlineFixture,
  startOnlineFixture,
  waitForFixture,
} from './online-fixture';

// Real Nest gateway + Socket.IO TCP/WebSocket clients + real isolated PostgreSQL.
// No score/ball/room-state injection and no mock production service/repository.
// Both clients use the canonical v1 input/snapshot contract through real sockets.
describe('real isolated online game service', () => {
  let fixture: OnlineFixture;
  beforeAll(async () => {
    fixture = await startOnlineFixture();
  }, 30000);
  afterAll(async () => {
    if (fixture) await fixture.close();
  }, 15000);

  it('rejects missing, malformed, and signed-but-unknown-user authentication', async () => {
    for (const credential of [
      'missing',
      'malformed',
      'unknown-user',
    ] as const) {
      const client = fixture.client(undefined, credential);
      const rejected = nextEvent<{ message: string }>(client, 'connect_error');
      client.connect();
      const error = await rejected;
      expect(error.message).toBe('Unauthorized');
      expect(client.connected).toBe(false);
      client.disconnect();
    }
  });

  it('matches two authenticated clients, advances a full score-ended game, and stores that result', async () => {
    const users = await Promise.all([
      fixture.createPlayer(),
      fixture.createPlayer(),
    ]);
    const clients = users.map((user) => fixture.client(user));
    await Promise.all(clients.map(connectFixtureClient));
    const ready = clients.map((client) =>
      nextEvent<ReadyMessage>(client, 'ready'),
    );
    const received = [0, 0];
    const positions = [new Set<number>(), new Set<number>()];
    clients.forEach((client) =>
      client.emit('matchmaking', { friendId: 0, mode: false }),
    );
    const rooms = await Promise.all(ready);
    rooms.forEach((room) => expect(isReadyMessage(room)).toBe(true));
    expect(rooms[0].roomId).toBe(rooms[1].roomId);
    expect(rooms[0].roomMode).toBe(false);
    const seq = [0, 0];
    let invalidSnapshots = 0;
    clients.forEach((client, index) => {
      client.on('snapshot', (data: Snapshot) => {
        if (!isSnapshot(data)) invalidSnapshots++;
        received[index]++;
        positions[index].add(data.state.ball.x);
        // Legal controls deliberately move away from the ball to reach a real
        // score ending quickly. Only the server owns movement/physics/score.
        client.emit('keyboardEvent', {
          v: 1,
          matchId: rooms[index].roomId,
          generation: rooms[index].generation,
          seq: ++seq[index],
          up: data.state.ball.y >= 400,
          down: data.state.ball.y < 400,
          actionId: 0,
        });
      });
    });
    const ended = clients.map((client) =>
      nextEvent<'left' | 'right'>(client, 'end', 90000),
    );
    const winners = await Promise.all(ended);
    clients.forEach((client) => client.removeAllListeners('snapshot'));
    expect(invalidSnapshots).toBe(0);
    expect(winners[0]).toBe(winners[1]);
    for (let index = 0; index < 2; index++) {
      expect(received[index]).toBeGreaterThan(6);
      expect(positions[index].size).toBeGreaterThan(6);
    }
    const match = await waitForFixture(
      () =>
        fixture.dataSource
          .getRepository(Match)
          .findOne({ where: { id: Number(rooms[0].roomId) } }),
      (value) => value?.winnerScore === 6 && value.winner !== null,
    );
    expect(match.winner.id).toBe(users[winners[0] === 'left' ? 0 : 1].id);
    expect(match.loserScore).toBeLessThan(6);
    clients.forEach((client) => client.disconnect());
  }, 100000);

  it('preserves friend invitation/refusal, accepted matches, and spectator updates', async () => {
    const users = await Promise.all([
      fixture.createPlayer(),
      fixture.createPlayer(),
      fixture.createPlayer(),
    ]);
    const [left, right, spectator] = users.map((user) => fixture.client(user));
    await Promise.all([left, right, spectator].map(connectFixtureClient));
    let invited = nextEvent(right, 'invited');
    left.emit('invite', { friendId: users[1].id, mode: true });
    await invited;
    const refused = [nextEvent(left, 'refuse'), nextEvent(right, 'refuse')];
    right.emit('refuse', { friendId: users[0].id, mode: true });
    await Promise.all(refused);
    invited = nextEvent(right, 'invited');
    left.emit('invite', { friendId: users[1].id, mode: true });
    await invited;
    const ready = [
      nextEvent<ReadyMessage>(left, 'ready'),
      nextEvent<ReadyMessage>(right, 'ready'),
    ];
    right.emit('joinFriend', users[0].id);
    const rooms = await Promise.all(ready);
    expect(rooms[0].roomMode).toBe(true);
    expect(rooms[0].roomId).toBe(rooms[1].roomId);
    const listed = nextEvent<Array<{ roomId: string }>>(spectator, 'roomlist');
    spectator.emit('roomlist');
    expect((await listed).some((room) => room.roomId === rooms[0].roomId)).toBe(
      true,
    );
    const initial = nextEvent<ReadyMessage>(spectator, 'setData');
    const update = nextEvent<Snapshot>(spectator, 'snapshot');
    spectator.emit('spectate', { id: rooms[0].roomId });
    const initialState = await initial;
    expect(isReadyMessage(initialState)).toBe(true);
    expect(initialState).toMatchObject({
      leftName: users[0].nickname,
      rightName: users[1].nickname,
      side: 'spectator',
    });
    expect(Number.isFinite((await update).state.ball.x)).toBe(true);
    const ended = [nextEvent(right, 'end'), nextEvent(spectator, 'end')];
    left.emit('end');
    await Promise.all(ended);
    const match = await waitForFixture(
      () =>
        fixture.dataSource
          .getRepository(Match)
          .findOne({ where: { id: Number(rooms[0].roomId) } }),
      (value) => value?.winner?.id === users[1].id,
    );
    expect(match.loser.id).toBe(users[0].id);
    [left, right, spectator].forEach((client) => client.disconnect());
  }, 30000);
});
