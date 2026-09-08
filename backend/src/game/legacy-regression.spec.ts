import { GameService } from './game.service';
import { Ball } from './pong-model/ball';
import { Bar } from './pong-model/player';
import { MatchService } from '../user/match.service';
import { Match } from '../user/entity/match.entity';
import { NotFoundException } from '@nestjs/common';

// Synthetic fixtures only: these tests never connect to a database or authenticate
// a real account. Expected-contract failures are recorded before production fixes.
function socket(id: number): any {
  return { user: { id, nickname: `fixture-${id}` }, emit: jest.fn() };
}

function service(overrides: Record<string, unknown> = {}) {
  const matches = {
    getMatchIndex: jest.fn().mockResolvedValue('2'),
    create: jest.fn().mockResolvedValue({ id: 41 }),
    update: jest.fn().mockResolvedValue({ id: 41 }),
    ...overrides,
  };
  const game = new GameService(matches as any, {} as any);
  return { game, matches, internals: game as any };
}

describe('legacy normal-rally characterization (observed rules, not new contracts)', () => {
  it('moves a free ball by the legacy per-call velocity', () => {
    const ball = new Ball(600, 400);
    expect(ball.update()).toEqual({ x: 610, y: 390 });
  });

  it('reflects the vertical velocity at the upper wall', () => {
    const ball = new Ball(600, 20);
    expect(ball.update()).toEqual({ x: 610, y: 30 });
    expect(ball.dY).toBe(10);
  });

  it('uses the legacy center-hit bias and charges only once while touching', () => {
    const ball = new Ball(1135, 400);
    const paddle = new Bar(1150, 300);
    expect(ball.rightPlayerCollision(paddle)).toBe(0);
    expect({ dx: ball.dX, dy: ball.dY, charge: paddle.stack }).toEqual({
      dx: -10,
      dy: 5,
      charge: 1,
    });
    ball.rightPlayerCollision(paddle);
    expect(paddle.stack).toBe(1);
    expect(ball.dX).toBe(-10);
  });

  it('clamps upward movement at the top edge', () => {
    const paddle = new Bar(20, 5);
    expect(paddle.update('up', false).y).toBe(0);
  });

  it('activates a fully charged Power paddle at its valid lower bound', () => {
    const paddle = new Bar(20, 575);
    paddle.stack = 5;
    expect(paddle.update('space', true)).toEqual({
      x: 20,
      y: 400,
      power: true,
    });
    expect(paddle.playerHeight).toBe(400);
  });

  it('keeps at most one waiting player through the current sequential join path', async () => {
    const { game, internals } = service();
    const first = socket(1);
    const second = socket(2);
    await game.addUser(first);
    await game.addUser(second);
    await game.joinMatch(first, { friendId: 0, mode: false });
    expect(internals.waitList).toHaveLength(1);
    await game.joinMatch(second, { friendId: 0, mode: false });
    expect(internals.waitList).toHaveLength(0);
  });
});

describe('expected contracts: baseline regression candidates', () => {
  it('C01 removes only the requested user and preserves unrelated invitations', async () => {
    const { game, internals } = service();
    const first = socket(1);
    const second = socket(2);
    const invitation = { from: socket(3), to: 4, mode: true };
    internals.userList = [first, second];
    internals.inviteList = [invitation];
    await game.deleteUser(first);
    expect(internals.userList).toEqual([second]);
    expect(internals.inviteList).toEqual([invitation]);
  });

  it('C02 leaves unrelated invitations intact when the requested invite is absent', async () => {
    const { game, internals } = service();
    const invitation = { from: socket(1), to: 2, mode: true };
    internals.inviteList = [invitation];
    await game.deleteInviteList(socket(3));
    expect(internals.inviteList).toEqual([invitation]);
  });

  it('C02 leaves present spectators intact when the requested spectator is absent', async () => {
    const present = socket(1);
    const { game } = service();
    const room = game.createRoom(
      '1',
      { socket: socket(3), mode: false },
      socket(4),
      false,
    );
    room.spectators.push(present);
    await room.removeSpectator(socket(2));
    expect(room.spectators).toEqual([present]);
  });

  it('C07 preserves a legal full downward step near the lower bound', () => {
    const paddle = new Bar(20, 575);
    expect(paddle.update('down', false).y).toBe(590);
  });

  it('C09 publishes the actual generated match id returned by persistence', async () => {
    const { game, internals } = service();
    const first = socket(1);
    const second = socket(2);
    await game.addUser(first);
    await game.addUser(second);
    await game.joinMatch(first, { friendId: 0, mode: false });
    await game.joinMatch(second, { friendId: 0, mode: false });
    expect(matchesReadyId(first)).toBe('41');
    expect(matchesReadyId(second)).toBe('41');
    expect(internals.rooms.has('41')).toBe(true);
  });

  it('C10 rejects a result update that affected no database row', async () => {
    const query: any = {};
    for (const method of [
      'update',
      'set',
      'where',
      'andWhere',
      'orderBy',
      'setLock',
    ])
      query[method] = jest.fn().mockReturnValue(query);
    query.getMany = jest
      .fn()
      .mockResolvedValue([socket(1).user, socket(2).user]);
    query.execute = jest.fn().mockResolvedValue({ affected: 0 });
    const matchesRepository = {
      createQueryBuilder: () => query,
      findOne: jest
        .fn()
        .mockResolvedValueOnce({ players: [socket(1).user, socket(2).user] })
        .mockResolvedValue(null),
    };
    const repository = {
      manager: {
        transaction: (work) =>
          work({
            getRepository: (entity) =>
              entity === Match
                ? matchesRepository
                : { createQueryBuilder: () => query },
          }),
      },
    };
    const matches = new MatchService(repository as any);
    await expect(
      matches.update('41', {
        winner: socket(1).user,
        loser: socket(2).user,
        winnerScore: 6,
        loserScore: 0,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(query.execute).toHaveBeenCalledTimes(1);
  });

  it('C10 reserves finalization before waiting for persistence during disconnect', async () => {
    let resolveSave: (value: unknown) => void;
    const save = new Promise((resolve) => {
      resolveSave = resolve;
    });
    const { game, internals, matches } = service({
      update: jest.fn().mockReturnValue(save),
    });
    const first = socket(1);
    const second = socket(2);
    await game.addUser(first);
    await game.addUser(second);
    await game.joinMatch(first, { friendId: 0, mode: false });
    await game.joinMatch(second, { friendId: 0, mode: false });
    const room = internals.rooms.get('41');
    // Same race boundary as the original test, expressed in the shared state:
    // a winning score awaits loop finalization while disconnect begins saving.
    room.runner.state.players.left.score = 6;
    room.runner.state.phase = 'finished';
    room.runner.state.winner = 'left';
    const disconnect = game.dropUser(first);
    game.loop();
    // Resolve even on a failed assertion so this test leaves no pending work.
    resolveSave({ id: 41 });
    await disconnect;
    expect(matches.update).toHaveBeenCalledTimes(1);
  });
});

function matchesReadyId(client: any): string | undefined {
  return client.emit.mock.calls.find(([event]) => event === 'ready')?.[1]
    .roomId;
}
