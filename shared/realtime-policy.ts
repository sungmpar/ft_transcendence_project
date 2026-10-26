/**
 * A server can observe a dead WebSocket before the browser receives its close.
 * Budget one successful reconnect under normal provider/authentication latency:
 * 8s detection + 1s backoff + 5s transport open + 12s authority recovery = 26s.
 * Namespace authentication and initial Redis preparation are additional work;
 * the 5s transport timeout does not bound the PostgreSQL authentication query.
 * The 30s grace pauses physics, but is not a hard end-to-end recovery guarantee
 * for slow external services or repeated unsuccessful reconnect attempts.
 * Engine.IO ping/pong does not add Redis commands.
 */
export const REALTIME_PING_INTERVAL_MS = 5000;
export const REALTIME_PING_TIMEOUT_MS = 3000;
export const GAME_RECONNECT_DELAY_MS = 250;
export const GAME_RECONNECT_DELAY_MAX_MS = 1000;
export const GAME_CONNECT_TIMEOUT_MS = 5000;
export const GAME_RECONNECT_GRACE_MS = 30000;
