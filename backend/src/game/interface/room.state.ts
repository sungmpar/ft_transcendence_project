import { AuthSocket } from '../game.middleware';
import { ServerMatchRunner } from '../server-match-runner';
import { Side } from '../../../../shared/game-core';

/** Session references stay outside the serializable shared game state. */
export class Room {
  spectators: AuthSocket[] = [];
  persistence: 'active' | 'saving' | 'saved' | 'failed' = 'active';
  completion?: Promise<void>;
  result?: { winner: Side; reason: 'score' | 'forfeit' | 'disconnect' };
  offline = new Map<Side, { expiresAt: number; generation: number }>();
  attempts = 0;
  retryAt = Infinity;

  constructor(
    readonly roomIndex: string,
    readonly gameMode: boolean,
    readonly players: [AuthSocket, AuthSocket],
    readonly runner: ServerMatchRunner,
  ) {}

  start(): void {
    this.runner.start();
  }

  removeSpectator(spectator: AuthSocket): void {
    const index = this.spectators.indexOf(spectator);
    if (index !== -1) this.spectators.splice(index, 1);
  }
}
