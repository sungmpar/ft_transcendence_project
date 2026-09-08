import { GameService } from './game.service';

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
    getOneForParticipant: jest.fn().mockResolvedValue(null),
    getOne: jest.fn().mockResolvedValue(null),
    ...overrides,
  };
  const game = new GameService(matches as any, {} as any, () => now);
  const players = [socket(1), socket(2), socket(3)];
  players.forEach((player) => void game.addUser(player));
  return {
    game,
    matches,
    players,
    internals: game as any,
    advance: (value: number) => {
      now = value;
      game.loop();
    },
  };
}
async function match(game: GameService, players: any[]) {
  await game.joinMatch(players[0], { friendId: 0, mode: false });
  await game.joinMatch(players[1], { friendId: 0, mode: false });
}
const request = (requestId = 'request-1', matchId = '41') => ({
  v: 1,
  requestId,
  matchId,
  role: 'player',
});

describe('N2 observer-owned resubscription', () => {
  const watchRequest = (requestId = 'watch-1', matchId = '41') => ({
    v: 1,
    requestId,
    matchId,
    role: 'spectator',
  });
  it('resubscribes only the disconnected observer with one registration and no input ownership', async () => {
    const { game, players, internals } = setup();
    await match(game, players);
    await game.spectate(players[2], { id: '41' });
    await game.dropUser(players[2], true);
    const returning = socket(3);
    await game.addUser(returning);
    const first = await sync(game, returning, watchRequest());
    expect(first).toMatchObject({
      status: 'active',
      ready: { roomId: '41', side: 'spectator' },
    });
    expect(await sync(game, returning, watchRequest('watch-2'))).toMatchObject({
      status: 'active',
    });
    expect(internals.rooms.get('41').spectators).toEqual([returning]);
    expect(internals.watching.get(returning)).toBe('41');
    expect(
      game.listenKeyEvent(returning, {
        v: 1,
        matchId: '41',
        generation: first.ready.generation,
        seq: 1,
        up: true,
        down: false,
        actionId: 0,
      }),
    ).toBe(false);
    expect(internals.rooms.get('41').offline.size).toBe(0);
  });

  it('returns a saved result when the match ended while its observer was offline', async () => {
    const { game, players } = setup();
    await match(game, players);
    await game.spectate(players[2], { id: '41' });
    await game.dropUser(players[2], true);
    await game.dropUser(players[0]);
    const returning = socket(3);
    await game.addUser(returning);
    expect(await sync(game, returning, watchRequest())).toMatchObject({
      status: 'saved',
      result: { outcome: 'spectator', winnerScore: 0, loserScore: 0 },
    });
  });

  it('does not let a current player subscribe as a spectator', async () => {
    const { game, players, internals } = setup();
    await match(game, players);
    expect(await sync(game, players[0], watchRequest())).toMatchObject({
      status: 'unavailable',
    });
    expect(internals.rooms.get('41').spectators).toEqual([]);
    expect(internals.bindings.has(players[0])).toBe(true);
  });

  it('rejects a spectator role spoof for a completed match the account never watched', async () => {
    const { game, players, matches } = setup();
    await match(game, players);
    await game.dropUser(players[0]);
    expect(await sync(game, players[2])).toMatchObject({
      status: 'unavailable',
    });
    expect(await sync(game, players[2], watchRequest())).toMatchObject({
      status: 'unavailable',
    });
    await game.spectate(players[2], { id: '41' });
    expect(matches.getOne).not.toHaveBeenCalled();
    expect(players[2].emit).not.toHaveBeenCalledWith(
      'finish',
      expect.anything(),
    );
  });

  it('expires prior observer grants and does not reconstruct them after a restart', async () => {
    const { game, players, matches, advance } = setup();
    await match(game, players);
    await game.spectate(players[2], { id: '41' });
    await game.dropUser(players[0]);
    advance(600001);
    expect(await sync(game, players[2], watchRequest())).toMatchObject({
      status: 'unavailable',
    });
    expect(matches.getOne).not.toHaveBeenCalled();
    const restarted = setup();
    expect(
      await sync(restarted.game, restarted.players[2], watchRequest()),
    ).toMatchObject({
      status: 'unavailable',
    });
    expect(restarted.matches.getOne).not.toHaveBeenCalled();
  });

  it('bounds completed-result observer grants and safely rejects an evicted grant', async () => {
    const { game, players, internals } = setup();
    await match(game, players);
    await game.spectate(players[2], { id: '41' });
    let latest: any;
    for (let id = 4; id <= 1003; id++) {
      latest = socket(id);
      await game.addUser(latest);
      await game.spectate(latest, { id: '41' });
    }
    expect(internals.observerGrants.size).toBe(1000);
    await game.dropUser(players[0]);
    expect(await sync(game, players[2], watchRequest())).toMatchObject({
      status: 'unavailable',
    });
    expect(await sync(game, latest, watchRequest())).toMatchObject({
      status: 'saved',
    });
  });

  it('ignores a completed lookup after a newer target was requested', async () => {
    let resolve: (value: unknown) => void;
    const getOne = jest
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((done) => {
            resolve = done;
          }),
      )
      .mockResolvedValue(null);
    const { game, players, internals } = setup({ getOne });
    await match(game, players);
    await game.spectate(players[2], { id: '41' });
    await game.dropUser(players[0]);
    internals.recentResults.clear(); // Eviction keeps only the prior observer's bounded grant.
    const old = sync(game, players[2], watchRequest());
    expect(
      await sync(game, players[2], watchRequest('watch-2', '42')),
    ).toMatchObject({ status: 'unavailable' }); // An unwatched target has no authority to start a lookup.
    resolve({
      winner: { nickname: 'a' },
      loser: { nickname: 'b' },
      winnerScore: 6,
      loserScore: 3,
    });
    expect(await old).toBeUndefined();
    expect(
      await sync(game, players[2], watchRequest('watch-3', '42')),
    ).toMatchObject({ status: 'unavailable' });
  });
});

it('releases every old socket binding after repeated reconnects during a pending save', async () => {
  let resolve: (value: unknown) => void;
  const { game, players, internals } = setup({
    update: jest.fn().mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    ),
  });
  await match(game, players);
  const finishing = game.dropUser(players[1]);
  const firstDrop = game.dropUser(players[0], true);
  await Promise.resolve();
  const second = socket(1);
  await game.addUser(second);
  await sync(game, second);
  const secondDrop = game.dropUser(second, true);
  await Promise.resolve();
  const third = socket(1);
  await game.addUser(third);
  await sync(game, third, request('return-2'));
  resolve({ id: 41 });
  await Promise.all([finishing, firstDrop, secondDrop]);
  expect(internals.bindings.size).toBe(0);
  expect(internals.matchByUser.size).toBe(0);
});

it('bounds concurrent recovery DB work to one lookup per authenticated account', async () => {
  let resolve: (value: unknown) => void;
  const getOneForParticipant = jest.fn().mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const { game, players } = setup({ getOneForParticipant });
  const pending = sync(game, players[0]);
  for (let index = 2; index <= 8; index++) {
    void sync(
      game,
      players[0],
      request(`request-${index}`, String(40 + index)),
    );
  }
  expect(getOneForParticipant).toHaveBeenCalledTimes(1);
  resolve(null);
  await pending;
});
const sync = (game: GameService, client: any, data = request()): Promise<any> =>
  (game as any).syncSession(client, data);

describe('N1 authenticated same-page match recovery', () => {
  it('returns the expired match result after room release without inventing six points', async () => {
    const { game, players, internals, advance } = setup();
    await match(game, players);
    const room = internals.rooms.get('41');
    await game.dropUser(players[0], true);
    advance(5001);
    await room.completion;
    expect(internals.rooms.size).toBe(0);
    const returning = socket(1);
    await game.addUser(returning);
    expect(await sync(game, returning)).toMatchObject({
      v: 1,
      requestId: 'request-1',
      matchId: '41',
      status: 'saved',
      result: { outcome: 'lost', winnerScore: 0, loserScore: 0 },
    });
  });

  it('reports saving and binds the returning participant to the eventual identified end', async () => {
    let resolve: (value: unknown) => void;
    const { game, players, internals, advance } = setup({
      update: jest.fn().mockReturnValue(
        new Promise((done) => {
          resolve = done;
        }),
      ),
    });
    await match(game, players);
    await game.dropUser(players[0], true);
    advance(5001);
    const returning = socket(1);
    await game.addUser(returning);
    expect(await sync(game, returning)).toMatchObject({
      status: 'saving',
      result: { outcome: 'lost' },
    });
    const room = internals.rooms.get('41');
    resolve({ id: 41 });
    await room.completion;
    expect(returning.emit).toHaveBeenCalledWith('matchEnded', {
      v: 1,
      roomId: '41',
      winner: 'right',
    });
  });

  it('distinguishes retrying and final storage failure from a saved outcome', async () => {
    const { game, players, internals, advance } = setup({
      update: jest.fn().mockRejectedValue(new Error('fixture failure')),
    });
    await match(game, players);
    await game.dropUser(players[0], true);
    advance(5001);
    const room = internals.rooms.get('41');
    await room.completion;
    const returning = socket(1);
    await game.addUser(returning);
    expect(await sync(game, returning)).toMatchObject({ status: 'retrying' });
    advance(6001);
    await room.completion;
    advance(8001);
    await room.completion;
    expect(await sync(game, returning, request('request-2'))).toMatchObject({
      status: 'failed',
      result: { outcome: 'lost', loserScore: 0 },
    });
  });

  it('uses an authorized saved DB result after restart and reports an unfinished row as unavailable', async () => {
    const getOneForParticipant = jest.fn().mockResolvedValue({
      winner: { id: 1, nickname: 'winner' },
      loser: { id: 2, nickname: 'loser' },
      winnerScore: 6,
      loserScore: 2,
    });
    const { game, players } = setup({ getOneForParticipant });
    expect(await sync(game, players[0])).toMatchObject({
      status: 'saved',
      result: { outcome: 'won', winnerScore: 6, loserScore: 2 },
    });
    expect(getOneForParticipant).toHaveBeenCalledWith('41', 1);
    getOneForParticipant.mockResolvedValue({ winner: null, loser: null });
    expect(
      await sync(game, players[0], request('request-2', '42')),
    ).toMatchObject({ status: 'unavailable' });
  });

  it('does not disclose a released result to a nonparticipant or a superseded socket', async () => {
    const { game, players, internals, advance, matches } = setup();
    await match(game, players);
    const room = internals.rooms.get('41');
    await game.dropUser(players[0], true);
    advance(5001);
    await room.completion;
    expect(await sync(game, players[2])).toMatchObject({
      status: 'unavailable',
    });
    const duplicate = socket(2);
    await game.addUser(duplicate);
    expect(duplicate.disconnect).toHaveBeenCalledWith(true);
    expect(await sync(game, duplicate)).toBeUndefined();
    expect(matches.getOneForParticipant).not.toHaveBeenCalled();
  });

  it('returns lookup error without creating an outcome and ignores malformed requests', async () => {
    const { game, players, matches } = setup({
      getOneForParticipant: jest
        .fn()
        .mockRejectedValue(new Error('fixture lookup failure')),
    });
    expect(await sync(game, players[0])).toMatchObject({ status: 'error' });
    expect(
      await sync(game, players[0], {
        ...request(),
        matchId: 'https://external.invalid',
      }),
    ).toBeUndefined();
    expect(matches.getOneForParticipant).toHaveBeenCalledTimes(1);
  });

  it('ignores a DB response superseded by a newer recovery request', async () => {
    let resolve: (value: unknown) => void;
    const getOneForParticipant = jest
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((done) => {
            resolve = done;
          }),
      )
      .mockResolvedValue(null);
    const { game, players } = setup({ getOneForParticipant });
    const late = sync(game, players[0]);
    expect(
      await sync(game, players[0], request('request-2', '42')),
    ).toMatchObject({ matchId: '42', status: 'error' });
    resolve({
      winner: { id: 1, nickname: 'a' },
      loser: { id: 2, nickname: 'b' },
      winnerScore: 6,
      loserScore: 1,
    });
    expect(await late).toBeUndefined();
    expect(
      await sync(game, players[0], request('request-3', '42')),
    ).toMatchObject({ status: 'unavailable' });
  });
});
