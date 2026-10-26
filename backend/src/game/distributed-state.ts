import { Side } from '../../../shared/game-core';
import { Snapshot } from '../../../shared/protocol';

export interface GameRuntimeState {
  v: 1;
  savedAt: number;
  generation: number;
  completedCommands?: { id: string; value: unknown; expiresAt: number }[];
  sockets: { socketId: string; user: { id: number; name: string; nickname: string } }[];
  sessions: { userId: number; socketId: string; generation: number }[];
  waitList: { socketId: string; mode: boolean }[];
  inviteList: { socketId: string; to: number; mode: boolean }[];
  watching: { socketId: string; roomId: string }[];
  observerGrants: { key: string; remainingMs: number }[];
  recentResults: {
    roomId: string; remainingMs: number; participants: number[];
    status: 'saved' | 'failed'; winnerId: number;
    result: { winnerName: string; loserName: string; winnerScore: number; loserScore: number };
  }[];
  rooms: {
    id: string; mode: boolean; playerSocketIds: [string, string];
    spectatorSocketIds: string[]; snapshot: Snapshot;
    persistence: 'active' | 'saving' | 'saved' | 'failed';
    result?: { winner: Side; reason: 'score' | 'forfeit' | 'disconnect' };
    offline: { side: Side; remainingMs: number; generation: number }[];
    attempts: number; retryRemainingMs: number | null;
  }[];
}
