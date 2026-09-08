import { isReadyMessage, isSessionSyncResponse, ReadyMessage, SessionSyncRequest, SessionSyncResponse } from '../../../shared/protocol';
export interface RecoveryTransport {
  connected: boolean;
  timeout(milliseconds: number): {
    emit(event: string, value: unknown, ack: (error: Error | null, value?: unknown) => void): unknown;
  };
}

/** Owns one bounded request and rejects callbacks after replacement/disposal. */
export class SessionRecovery {
  private sequence = 0;
  private request: SessionSyncRequest | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private disposed = false;
  private current: (Pick<ReadyMessage, 'roomId' | 'generation'> & { instanceId: string }) | null = null;
  private expected = '';
  private retired = new Set<string>();

  constructor(private socket: RecoveryTransport, private role: SessionSyncRequest['role'],
    private onResponse: (response: SessionSyncResponse | null) => void) {}

  expect(matchId: string): void {
    this.cancel();
    this.expected = matchId;
    if (this.role === 'spectator') this.retired.delete(matchId);
  }
  private canAcceptReady(value: unknown): value is ReadyMessage {
    if (this.disposed || !isReadyMessage(value) || this.retired.has(value.roomId) ||
      (this.role === 'spectator') !== (value.side === 'spectator') ||
      (this.expected && value.roomId !== this.expected) ||
      (this.current?.roomId === value.roomId &&
        (value.snapshot.instanceId !== this.current.instanceId || value.generation <= this.current.generation))) return false;
    return true;
  }
  acceptReady(value: unknown): value is ReadyMessage {
    if (!this.canAcceptReady(value)) return false;
    this.cancel();
    this.expected = value.roomId;
    this.current = { roomId: value.roomId, generation: value.generation, instanceId: value.snapshot.instanceId };
    return true;
  }
  resume(matchId = this.expected): void {
    if (this.disposed || !this.socket.connected || !matchId) return;
    this.cancel();
    this.expected = matchId;
    const request: SessionSyncRequest = { v: 1, requestId: `sync-${++this.sequence}`, matchId, role: this.role };
    this.request = request;
    this.timer = setTimeout(() => {
      if (this.disposed || this.request !== request) return;
      this.cancel(); this.onResponse(null);
    }, 5000);
    // Socket.IO's own timeout also removes its ACK registry and buffered packet.
    // The owner timer below is separate: cancel/dispose must ignore late ACKs.
    this.socket.timeout(5000).emit('sessionSync', request, (error, value) => {
      if (error) {
        if (!this.disposed && this.request === request) { this.cancel(); this.onResponse(null); }
        return;
      }
      if (this.disposed || this.request !== request || !isSessionSyncResponse(value) ||
        value.requestId !== request.requestId || value.matchId !== request.matchId ||
        ('ready' in value && !this.canAcceptReady(value.ready))) return;
      this.cancel(); this.onResponse(value);
    });
  }
  finish(matchId: string): boolean {
    if (this.disposed || !this.expected || matchId !== this.expected || this.retired.has(matchId)) return false;
    this.cancel();
    this.retired.add(matchId);
    while (this.retired.size > 32) this.retired.delete(this.retired.values().next().value as string);
    this.current = null;
    return true;
  }
  clear(): void {
    if (this.expected) this.finish(this.expected);
    this.expected = '';
    this.current = null;
    this.cancel();
  }
  cancel(): void {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
    this.request = null;
  }
  dispose(): void { this.cancel(); this.disposed = true; }
}

export function recoveryMessage(value: SessionSyncResponse | null): string {
  if (!value || value.status === 'error') return '경기 상태 조회에 실패했습니다. 다시 확인하거나 로비로 돌아갈 수 있습니다. 승패는 확인되지 않았습니다.';
  if (value.status === 'unavailable') return '이전 경기를 복구할 수 없습니다. 종료되었거나 서버가 다시 시작되었을 수 있습니다. 로비에서 다시 플레이하세요.';
  if (value.status === 'saving') return '경기 종료 · 결과를 저장하고 있습니다.';
  if (value.status === 'retrying') return '경기 종료 · 결과 저장을 재시도하고 있습니다.';
  if (value.status === 'failed') return '경기는 종료됐지만 결과 저장 확인에 실패했습니다. 전적 반영 여부를 확인할 수 없습니다.';
  if (value.status === 'saved') return '경기 결과가 저장되었습니다.';
  return value.status === 'waiting' ? '상대 연결 대기 · 경기가 일시정지되었습니다' : '서버 경기 상태를 복구했습니다.';
}
