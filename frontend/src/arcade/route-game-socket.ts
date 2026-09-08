import io, { Socket } from 'socket.io-client';
import store from '@/store';

/** Each rendered online route owns its connection, opened only after mount. */
export function createRouteGameSocket(): Socket {
  const base = process.env.VUE_APP_WS_URL || window.location.origin.replace(/^http/, 'ws');
  const socket = io(`${base}/game`, { autoConnect: false, transports: ['websocket'],
    auth: { token: localStorage.getItem('token') } });
  store.commit('setGameSocket', socket);
  return socket;
}
