import { GameService } from './game.service';
import { isReadyMessage } from '../../../shared/protocol';

function socket(id: number): any {
  return {
    user: { id, name: `fixture-${id}`, nickname: `fixture-${id}` },
    emit: jest.fn(),
    disconnect: jest.fn(),
  };
}
function setup(overrides = {}) {
  let now = 0;
  const matches = {
    create: jest.fn().mockResolvedValue({ id: 41 }),
    update: jest.fn().mockResolvedValue({ id: 41 }),
    delete: jest.fn().mockResolvedValue(true),
    ...overrides,
  };
  const game = new GameService(matches as any, {} as any, () => now);
  const players = [socket(1), socket(2), socket(3), socket(4)];
  players.forEach((player) => {
    void game.addUser(player);
  });
  return {
    game,
    matches,
    players,
    internals: game as any,
    advance: (time: number) => {
      now = time;
      game.loop();
    },
  };
}
async function match(game: GameService, left: any, right: any, power = false) {
  await game.joinMatch(left, { friendId: 0, mode: power });
  await game.joinMatch(right, { friendId: 0, mode: power });
}
const ready = (player: any) =>
  player.emit.mock.calls.find(([event]) => event === 'ready')?.[1];

describe('authenticated server ownership and match publication', () => {
  it('reserves both players across the DB await and publishes only the generated id', async () => {
    let resolve: (value: unknown) => void;
    const pending = new Promise((done) => {
      resolve = done;
    });
    const { game, matches, players } = setup({
      create: jest.fn().mockReturnValue(pending),
    });
    await game.joinMatch(players[0], { friendId: 0, mode: true });
    const joining = game.joinMatch(players[1], { friendId: 0, mode: true });
    await game.joinMatch(players[0], { friendId: 0, mode: true });
    await game.joinMatch(players[1], { friendId: 0, mode: true });
    expect(matches.create).toHaveBeenCalledTimes(1);
    expect(ready(players[0])).toBeUndefined();
    resolve({ id: 97 });
    await joining;
    expect(ready(players[0]).roomId).toBe('97');
    expect(ready(players[1]).roomId).toBe('97');
    expect(isReadyMessage(ready(players[0]))).toBe(true);
    expect(isReadyMessage(ready(players[1]))).toBe(true);
    expect(ready(players[0]).roomMode).toBe(true);
  });

  it('cancels an unpublished match if a reserved participant disconnects', async () => {
    let resolve: (value: unknown) => void;
    const pending = new Promise((done) => {
      resolve = done;
    });
    const { game, matches, players, internals } = setup({
      create: jest.fn().mockReturnValue(pending),
    });
    await game.joinMatch(players[0], { friendId: 0, mode: false });
    const joining = game.joinMatch(players[1], { friendId: 0, mode: false });
    await game.dropUser(players[0], true);
    resolve({ id: 97 });
    await joining;
    expect(matches.delete).toHaveBeenCalledWith('97');
    expect(ready(players[1])).toBeUndefined();
    expect(internals.rooms.size).toBe(0);
    expect(internals.reservations.size).toBe(0);
  });

  it('preserves the first connection when a second tab claims the same account', async () => {
    const { game, players } = setup();
    const secondTab = socket(1);
    await game.addUser(secondTab);
    expect(secondTab.disconnect).toHaveBeenCalledWith(true);
    await game.dropUser(secondTab, true);
    await match(game, players[0], players[1]);
    expect(ready(players[0])).toBeDefined();
    expect(ready(secondTab)).toBeUndefined();
  });

  it('rejects spectator, forged-account socket, and extra-field input', async () => {
    const { game, players, internals, advance } = setup();
    await match(game, players[0], players[1]);
    await game.spectate(players[2], { id: '41' });
    const full = players[2].emit.mock.calls.find(
      ([event]) => event === 'setData',
    )[1];
    expect(isReadyMessage(full)).toBe(true);
    expect(full.side).toBe('spectator');
    const input = {
      v: 1,
      matchId: '41',
      generation: ready(players[0]).generation,
      seq: 1,
      up: true,
      down: false,
      actionId: 0,
    };
    expect(game.listenKeyEvent(players[2], input)).toBe(false);
    expect(game.listenKeyEvent(socket(1), input)).toBe(false);
    expect(game.listenKeyEvent(players[0], { ...input, playerId: 1 })).toBe(
      false,
    );
    expect(game.listenKeyEvent(players[0], input)).toBe(true);
    advance(17);
    expect(internals.rooms.get('41').runner.state.players.left.y).toBe(285);
    expect(internals.rooms.get('41').runner.state.players.right.y).toBe(300);
  });

  it('targets the numeric invitation sender while preserving another pending invitation', async () => {
    const { game, players, internals } = setup();
    await game.invite(players[0], { friendId: 3, mode: false });
    await game.invite(players[1], { friendId: 3, mode: true });
    await game.refuse(players[2], 2);
    expect(internals.inviteList).toHaveLength(1);
    expect(internals.inviteList[0].from).toBe(players[0]);
    expect(players[1].emit).toHaveBeenCalledWith('refuse');
  });

  it('retries storage three times, preserves the failure result, and releases control without advancing', async () => {
    const { game, players, internals, advance } = setup({
      update: jest.fn().mockRejectedValue(new Error('fixture storage failure')),
    });
    await match(game, players[0], players[1]);
    await game.dropUser(players[0]);
    const room = internals.rooms.get('41');
    expect(room.persistence).toBe('failed');
    expect(players[1].emit).toHaveBeenCalledWith(
      'resultStatus',
      expect.objectContaining({ roomId: '41', status: 'retrying', attempt: 1 }),
    );
    expect(players[1].emit.mock.calls.some(([event]) => event === 'matchEnded')).toBe(
      false,
    );
    const tick = room.runner.state.tick;
    advance(1000);
    await room.completion;
    expect(room.runner.state.tick).toBe(tick);
    advance(2000);
    await room.completion;
    expect(internals.rooms.has('41')).toBe(false);
    expect(internals.matchByUser.size).toBe(0);
    expect(internals.bindings.size).toBe(0);
    expect(internals.failedResults).toHaveLength(1);
    expect(players[1].emit).toHaveBeenCalledWith(
      'resultStatus',
      expect.objectContaining({
        status: 'failed',
        attempt: 3,
        winner: 'right',
      }),
    );
    expect(players[1].emit).toHaveBeenCalledWith('matchEnded', { v: 1, roomId: '41', winner: 'right' });
  });

  it('pauses disconnect grace and resumes with new input epochs without catch-up or old-socket control', async () => {
    const { game, players, internals, advance } = setup();
    await match(game, players[0], players[1]);
    await game.spectate(players[2], { id: '41' });
    const originalSpectator = players[2].emit.mock.calls.find(
      ([event]) => event === 'setData',
    )[1];
    const oldGeneration = ready(players[0]).generation;
    advance(17);
    const room = internals.rooms.get('41');
    const tick = room.runner.state.tick;
    await game.dropUser(players[0], true);
    advance(4017);
    expect(room.runner.state.tick).toBe(tick);
    const reconnected = socket(1);
    await game.addUser(reconnected);
    const full = ready(reconnected);
    expect(isReadyMessage(full)).toBe(true);
    expect(full.generation).toBeGreaterThan(oldGeneration);
    expect(full.snapshot.tick).toBe(tick);
    const spectatorResync = players[2].emit.mock.calls
      .filter(([event]) => event === 'setData')
      .slice(-1)[0][1];
    expect(spectatorResync.generation).toBeGreaterThan(
      originalSpectator.generation,
    );
    expect(spectatorResync.snapshot.tick).toBe(tick);
    const oldInput = {
      v: 1,
      matchId: '41',
      generation: oldGeneration,
      seq: 1,
      up: true,
      down: false,
      actionId: 0,
    };
    expect(game.listenKeyEvent(players[0], oldInput)).toBe(false);
    expect(game.listenKeyEvent(reconnected, oldInput)).toBe(false);
    await game.dropUser(players[0], true);
    expect(internals.sessions.get(1).socket).toBe(reconnected);
    expect(
      game.listenKeyEvent(reconnected, {
        ...oldInput,
        generation: full.generation,
      }),
    ).toBe(true);
    advance(4034);
    expect(room.runner.state.tick).toBe(tick + 1);
    expect(room.runner.state.players.left.y).toBe(285);
  });

  it('ends an expired disconnect grace once and leaves explicit forfeit immediate', async () => {
    const { game, players, internals, matches, advance } = setup();
    await match(game, players[0], players[1]);
    const room = internals.rooms.get('41');
    await game.dropUser(players[0], true);
    expect(matches.update).not.toHaveBeenCalled();
    advance(5001);
    await room.completion;
    expect(matches.update).toHaveBeenCalledTimes(1);
    expect(players[1].emit).toHaveBeenCalledWith('matchEnded', { v: 1, roomId: '41', winner: 'right' });
    advance(10001);
    expect(matches.update).toHaveBeenCalledTimes(1);
  });

  it('releases an aborted room without inventing a winner and keeps another room ticking', async () => {
    let id = 0;
    const { game, players, internals, advance } = setup({
      create: jest.fn().mockImplementation(async () => ({ id: ++id })),
    });
    await match(game, players[0], players[1]);
    await match(game, players[2], players[3]);
    const damaged = internals.rooms.get('1');
    const healthy = internals.rooms.get('2');
    jest.spyOn(damaged.runner, 'advance').mockImplementation(() => {
      throw new Error('fixture simulation fault');
    });
    advance(17);
    expect(healthy.runner.state.tick).toBe(1);
    expect(internals.rooms.has('1')).toBe(false);
    expect(internals.matchByUser.has(1)).toBe(false);
    expect(internals.bindings.has(players[0])).toBe(false);
    expect(players[0].emit).toHaveBeenCalledWith('sessionStatus', {
      roomId: '1',
      status: 'aborted',
    });
    expect(players[0].emit.mock.calls.some(([event]) => event === 'matchEnded')).toBe(
      false,
    );
    await Promise.resolve();
    expect(internals.failedResults[0]).toMatchObject({
      winner: null,
      reason: 'simulation',
      cleanup: 'removed',
    });
  });
});
