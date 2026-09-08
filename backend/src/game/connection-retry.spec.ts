import { ACTIVE_SESSION_CONFLICT, ConnectionRetry, CONNECTION_RETRY_TIMEOUT_MS } from '../../../frontend/src/arcade/connection-retry';

describe('explicit retry after a server-confirmed active-owner conflict', () => {
  // Installed Jest 28 cannot replace Node 18's read-only performance property.
  // The helper uses only setTimeout; keep that deadline deterministic.
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

  function setup(connected = false) {
    const socket = {
      connected,
      connect: jest.fn(),
      disconnect: jest.fn(() => { socket.connected = false; }),
    };
    const changed = jest.fn();
    const retry = new ConnectionRetry(socket, changed);
    return { socket, changed, retry };
  }

  it('leaves initial connection and ordinary transport or game errors to Socket.IO', () => {
    const { socket, retry, changed } = setup();
    for (const error of [null, 'websocket error', new Error('websocket error'),
      { message: '관전 정보를 가져올 수 없습니다.' }, { message: ACTIVE_SESSION_CONFLICT + 'x' }]) {
      expect(retry.reject(error)).toBe(false);
    }
    jest.advanceTimersByTime(30000);
    expect(socket.connect).not.toHaveBeenCalled();
    expect(socket.disconnect).not.toHaveBeenCalled();
    expect(changed).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('publishes the exact refusal before closing only the rejected socket and never auto-retries it', () => {
    const { socket, retry } = setup(true);
    socket.disconnect.mockImplementation(() => {
      expect(retry.state).toEqual({ pending: false, message: ACTIVE_SESSION_CONFLICT });
      socket.connected = false;
    });
    expect(retry.reject({ message: ACTIVE_SESSION_CONFLICT })).toBe(true);
    expect(retry.reject({ message: ACTIVE_SESSION_CONFLICT })).toBe(true);
    jest.advanceTimersByTime(30000);
    expect(socket.disconnect).toHaveBeenCalledTimes(1);
    expect(socket.connect).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('starts one explicit attempt on the same socket and suppresses repeated clicks', () => {
    const { socket, retry } = setup(true);
    retry.reject({ message: ACTIVE_SESSION_CONFLICT });
    expect(retry.retry()).toBe(true);
    expect(retry.retry()).toBe(false);
    expect(retry.state.pending).toBe(true);
    expect(socket.connect).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(1);
    socket.connected = true;
    expect(retry.connected()).toBe(true);
    expect(retry.state).toEqual({ pending: false, message: '' });
    expect(retry.retry()).toBe(false);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('stops an unconfirmed explicit attempt at five seconds and allows a new user attempt', () => {
    const { socket, retry } = setup();
    retry.retry();
    jest.advanceTimersByTime(CONNECTION_RETRY_TIMEOUT_MS - 1);
    expect(socket.disconnect).not.toHaveBeenCalled();
    expect(retry.state.pending).toBe(true);
    jest.advanceTimersByTime(1);
    expect(socket.disconnect).toHaveBeenCalledTimes(1);
    expect(retry.state.pending).toBe(false);
    expect(retry.state.message).toContain('5초');
    jest.advanceTimersByTime(30000);
    expect(socket.connect).toHaveBeenCalledTimes(1);
    expect(retry.retry()).toBe(true);
    expect(socket.connect).toHaveBeenCalledTimes(2);
  });

  it('invalidates a captured deadline after connection succeeds without changing the match protocol', () => {
    const schedule = jest.spyOn(globalThis, 'setTimeout');
    const { socket, retry, changed } = setup();
    retry.retry();
    const lateDeadline = schedule.mock.calls[0][0] as () => void;
    socket.connected = true;
    expect(retry.connected()).toBe(true);
    changed.mockClear();
    lateDeadline();
    expect(changed).not.toHaveBeenCalled();
    expect(socket.disconnect).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('retains a new active-owner refusal during an explicit retry and blocks a late automatic connection', () => {
    const { socket, retry } = setup();
    retry.retry();
    socket.connected = true;
    retry.connected();
    retry.reject({ message: ACTIVE_SESSION_CONFLICT });
    expect(retry.connected()).toBe(false);
    expect(retry.state).toEqual({ pending: false, message: ACTIVE_SESSION_CONFLICT });
    expect(jest.getTimerCount()).toBe(0);
  });

  it('cleans its timer and ignores every late callback after route disposal', () => {
    const schedule = jest.spyOn(globalThis, 'setTimeout');
    const { socket, retry, changed } = setup();
    retry.retry();
    const lateDeadline = schedule.mock.calls[0][0] as () => void;
    retry.dispose(); retry.dispose();
    changed.mockClear(); socket.connect.mockClear(); socket.disconnect.mockClear();
    lateDeadline();
    expect(retry.connected()).toBe(false);
    expect(retry.reject({ message: ACTIVE_SESSION_CONFLICT })).toBe(false);
    expect(retry.retry()).toBe(false);
    expect(jest.getTimerCount()).toBe(0);
    expect(changed).not.toHaveBeenCalled();
    expect(socket.connect).not.toHaveBeenCalled();
    expect(socket.disconnect).not.toHaveBeenCalled();
  });

  it('returns owned notice data so a view cannot mutate the retry guard', () => {
    const { retry } = setup();
    retry.retry();
    const copy = retry.state;
    copy.pending = false; copy.message = '';
    expect(retry.retry()).toBe(false);
    expect(retry.state.pending).toBe(true);
  });
});
