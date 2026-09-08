import { createSeededRng } from '../../../shared/game-core';
import { isSnapshot } from '../../../shared/protocol';
import { ServerMatchRunner } from './server-match-runner';

function runner(power = false) {
  return new ServerMatchRunner(
    '41',
    power,
    { left: 1, right: 2 },
    0,
    createSeededRng(41),
  );
}

describe('server clock/input/snapshot adapter', () => {
  it('runs 60 simulation ticks and 20 captured snapshots during the first second', () => {
    const game = runner();
    let snapshots = 0;
    for (let now = 10; now <= 1000; now += 10) {
      const result = game.advance(now);
      if (result.snapshot) {
        snapshots++;
        expect(isSnapshot(result.snapshot)).toBe(true);
      }
    }
    expect(game.state.tick).toBe(60);
    expect(snapshots).toBe(20);
  });

  it('acknowledges input only after a successful core step and expires missing releases', () => {
    const game = runner();
    expect(
      game.receive(
        'left',
        {
          v: 1,
          matchId: '41',
          generation: 1,
          seq: 1,
          up: true,
          down: false,
          actionId: 0,
        },
        0,
      ),
    ).toBe(true);
    expect(game.snapshot().ack.left).toBe(0);
    game.advance(17);
    expect(game.snapshot().ack.left).toBe(1);
    expect(game.state.players.left.y).toBe(285);
    const y = game.state.players.left.y;
    game.advance(400);
    expect(game.state.players.left.y).toBe(y);
  });

  it('separates held movement and Power edges without exceeding the shared clamp', () => {
    const game = runner(true);
    game.state.phase = 'rally';
    game.state.players.left.charge = 5;
    game.state.players.left.y = 575;
    game.receive(
      'left',
      {
        v: 1,
        matchId: '41',
        generation: 1,
        seq: 1,
        up: true,
        down: false,
        actionId: 1,
      },
      0,
    );
    game.advance(17);
    expect(game.state.players.left).toMatchObject({
      y: 385,
      height: 400,
      powered: true,
    });
    expect(isSnapshot(game.snapshot())).toBe(true);
    expect(game.inputs.left.take(18).action).toBe(false);
  });

  it('rejects wrong-room/wrong-generation input and bounds delayed scheduler work', () => {
    const game = runner();
    expect(
      game.receive(
        'left',
        {
          v: 1,
          matchId: '41',
          generation: 2,
          seq: 1,
          up: true,
          down: false,
          actionId: 0,
        },
        0,
      ),
    ).toBe(false);
    expect(
      game.receive(
        'left',
        {
          v: 1,
          matchId: '42',
          generation: 1,
          seq: 1,
          up: true,
          down: false,
          actionId: 0,
        },
        0,
      ),
    ).toBe(false);
    game.advance(5000);
    expect(game.state.tick).toBe(8);
    expect(game.metrics.droppedMs).toBeGreaterThan(4800);
  });

  it('makes start/stop/dispose repeatable and prevents late work after disposal', () => {
    const game = runner();
    game.start(0);
    game.advance(17);
    game.stop();
    game.stop();
    game.advance(1000);
    expect(game.state.tick).toBe(1);
    game.start(1000);
    game.advance(1017);
    expect(game.state.tick).toBe(2);
    game.dispose();
    game.dispose();
    game.start(2000);
    game.advance(2017);
    expect(game.state.tick).toBe(2);
  });

  it('changes presentation epoch only on dropped time or a real pause/resume, independently of input ownership', () => {
    const game = runner();
    const first = game.snapshot();
    for (let now = 10; now <= 1000; now += 10) game.advance(now);
    expect(game.snapshot().clockEpoch).toBe(0);
    const stalled = game.advance(1500).snapshot!;
    expect(stalled.instanceId).toBe(first.instanceId);
    expect(stalled.clockEpoch).toBe(1);
    expect(game.generations).toEqual({ left: 1, right: 2 });
    game.replaceInput('left', 9);
    expect(game.snapshot().clockEpoch).toBe(1);
    game.stop(); game.stop();
    game.start(2000); game.start(2000);
    const resumed = game.snapshot();
    expect(resumed.clockEpoch).toBe(2);
    expect(resumed.tick).toBe(stalled.tick);
    expect(resumed.seq).toBeGreaterThan(stalled.seq);
    expect(game.generations).toEqual({ left: 9, right: 2 });
    expect(runner().snapshot().instanceId).not.toBe(first.instanceId);
  });
});
