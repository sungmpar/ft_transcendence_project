export const ACTIVE_SESSION_CONFLICT = '이미 연결된 게임 세션이 있습니다. 기존 탭을 닫고 다시 연결해 주세요.';
export const CONNECTION_RETRY_TIMEOUT_MS = 5000;

export interface RetrySocket {
  connected: boolean;
  connect(): unknown;
  disconnect(): unknown;
}
export interface ConnectionRetryState { pending: boolean; message: string }

/** Stops only an explicit active-owner rejection. Ordinary transport recovery
 * still belongs to Socket.IO; only a user-requested retry gets this deadline.
 */
export class ConnectionRetry {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private generation = 0;
  private stopped = false;
  private disposed = false;
  private value: ConnectionRetryState = { pending: false, message: '' };

  constructor(private socket: RetrySocket,
    private onChange: (state: ConnectionRetryState) => void) {}
  get state(): ConnectionRetryState { return { ...this.value }; }
  private report(pending: boolean, message: string): void {
    this.value = { pending, message }; this.onChange(this.state);
  }
  private cancel(): void {
    this.generation++;
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
  }

  reject(value: unknown): boolean {
    if (this.disposed || !value || typeof value !== 'object' ||
      (value as { message?: unknown }).message !== ACTIVE_SESSION_CONFLICT) return false;
    if (this.stopped) return true;
    this.cancel(); this.stopped = true;
    // Publish first: the synchronous disconnect callback must retain this reason.
    this.report(false, ACTIVE_SESSION_CONFLICT);
    this.socket.disconnect();
    return true;
  }

  retry(): boolean {
    if (this.disposed || this.value.pending || this.socket.connected) return false;
    this.cancel(); this.stopped = false;
    const generation = this.generation;
    this.timer = setTimeout(() => {
      if (this.disposed || generation !== this.generation) return;
      this.cancel(); this.stopped = true;
      this.report(false, '5초 안에 연결을 확인하지 못했습니다. 기존 탭과 네트워크를 확인한 뒤 다시 시도하거나 메뉴로 돌아가세요.');
      this.socket.disconnect();
    }, CONNECTION_RETRY_TIMEOUT_MS);
    this.report(true, '서버 연결을 다시 확인하고 있습니다. 연결 뒤 이전 경기 상태를 조회합니다.');
    this.socket.connect();
    return true;
  }

  connected(): boolean {
    if (this.disposed) return false;
    if (this.stopped) { this.socket.disconnect(); return false; }
    this.cancel(); this.report(false, '');
    return true;
  }
  dispose(): void { this.disposed = true; this.cancel(); }
}
