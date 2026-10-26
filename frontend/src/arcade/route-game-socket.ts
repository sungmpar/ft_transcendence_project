import io, { Socket } from 'socket.io-client';
import store from '@/store';
import { GAME_CONNECT_TIMEOUT_MS, GAME_RECONNECT_DELAY_MAX_MS,
  GAME_RECONNECT_DELAY_MS } from '../../../shared/realtime-policy';

/** Each rendered online route owns its connection, opened only after mount. */
export function createRouteGameSocket(): Socket {
  const base = process.env.VUE_APP_WS_URL || window.location.origin.replace(/^http/, 'ws');
  // A cached chat Manager can auto-connect this route before mount, while this
  // route's deferred Manager can prevent a later chat from connecting at all.
  const socket = io(`${base}/game`, { forceNew: true, autoConnect: false, transports: ['websocket'],
    reconnectionDelay: GAME_RECONNECT_DELAY_MS, reconnectionDelayMax: GAME_RECONNECT_DELAY_MAX_MS,
    timeout: GAME_CONNECT_TIMEOUT_MS,
    auth: { token: localStorage.getItem('token') } });
  store.commit('setGameSocket', socket);
  return socket;
}
