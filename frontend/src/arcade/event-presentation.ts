import { GameEvent } from '../../../shared/game-core';
import { copyServerEvents, MAX_SNAPSHOT_EVENTS, ServerEvent, Snapshot } from '../../../shared/protocol';

export const MAX_EFFECT_LATENESS_TICKS = 6;
export interface EventMetrics { received: number; presented: number; skipped: number; queued: number }
const boundary = (event: GameEvent) => ['serve', 'point', 'finished'].includes(event.type);

/** Receives only validated, buffer-accepted snapshots. Never infers collisions. */
export class EventPresentation {
  private readonly matchId: string;
  private readonly instanceId: string;
  private epoch: number;
  private cursor: number;
  private sequence: number;
  private queue: ServerEvent[] = [];
  private done = false;
  private counts = { received: 0, presented: 0, skipped: 0 };

  constructor(initial: Snapshot) {
    this.matchId = initial.matchId; this.instanceId = initial.instanceId;
    this.epoch = initial.clockEpoch; this.cursor = initial.eventCursor; this.sequence = initial.seq;
    this.counts.skipped = initial.events.length; // Full ready is a no-history boundary.
  }
  get metrics(): EventMetrics { return { ...this.counts, queued: this.queue.length }; }

  receive(snapshot: Snapshot): void {
    if (this.done || snapshot.matchId !== this.matchId || snapshot.instanceId !== this.instanceId ||
      snapshot.clockEpoch < this.epoch || snapshot.seq <= this.sequence || snapshot.eventCursor < this.cursor) return;
    this.sequence = snapshot.seq;
    if (snapshot.clockEpoch > this.epoch) {
      this.counts.skipped += this.queue.length + snapshot.events.length;
      this.queue = []; this.epoch = snapshot.clockEpoch; this.cursor = snapshot.eventCursor;
      return;
    }
    const incoming = snapshot.events.filter(entry => entry.id > this.cursor);
    this.queue.push(...copyServerEvents(incoming));
    this.counts.received += incoming.length;
    this.cursor = snapshot.eventCursor;
    if (this.queue.length > MAX_SNAPSHOT_EVENTS) {
      this.counts.skipped += this.queue.length - MAX_SNAPSHOT_EVENTS;
      this.queue = this.queue.slice(-MAX_SNAPSHOT_EVENTS);
    }
  }

  take(presentationTick: number | null): GameEvent[] {
    if (this.done || presentationTick === null || !Number.isFinite(presentationTick)) return [];
    let count = 0;
    while (count < this.queue.length && this.queue[count].event.tick <= presentationTick) count++;
    const due = this.queue.splice(0, count);
    // A displayed point/serve boundary discards earlier feedback in this batch.
    const lastBoundary = due.filter(entry => boundary(entry.event)).pop()?.event.tick ?? -Infinity;
    const accepted = due.filter(({ event }) => event.tick >= lastBoundary &&
      presentationTick - event.tick <= MAX_EFFECT_LATENESS_TICKS);
    this.counts.skipped += due.length - accepted.length;
    this.counts.presented += accepted.length;
    return accepted.map(entry => entry.event);
  }

  /** Immediate terminal snap: only an actual terminal-tick score event may play.
   * Earlier hits are never pulled forward; forfeits cannot manufacture a point.
   */
  terminal(snapshot: Snapshot): GameEvent[] {
    if (this.done) return [];
    const accepted = snapshot.matchId === this.matchId && snapshot.instanceId === this.instanceId &&
      snapshot.clockEpoch === this.epoch && snapshot.state.phase === 'finished'
      ? this.queue.filter(({ event }) => event.tick === snapshot.tick && ['point', 'finished'].includes(event.type)) : [];
    this.counts.skipped += this.queue.length - accepted.length;
    this.counts.presented += accepted.length;
    this.queue = []; this.done = true;
    return accepted.map(entry => entry.event);
  }
  discardPending(): void { this.counts.skipped += this.queue.length; this.queue = []; }
  dispose(): void { this.discardPending(); this.done = true; }
}
