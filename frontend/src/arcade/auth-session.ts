import axios from 'axios';
import store from '@/store';
import { GameplayService } from '@/plugins/gamePlayService';
import { clearLoginIntent } from './login-intent';

export function clearLocalSession(): void {
  clearLoginIntent();
  GameplayService.dispose();
  const gameSocket = store.getters.gameSocket;
  if (gameSocket?.connected) gameSocket.emit('end');
  gameSocket?.close();
  store.getters.socket?.close();
  store.commit('setGameSocket', null);
  store.commit('setSocket', null);
  store.commit('setOnlineState', null);
  store.commit('setOpenFriends', false);
  store.commit('setFriends', []);
  store.commit('setMatch', []);
  store.commit('setChannels', []);
  store.commit('setAllChannels', []);
  store.commit('setUsers', []);
  store.commit('setChannel', { id: null, name: '', messages: [] });
  store.commit('setProfileUser', {});
  store.commit('setOpenProfile', false);
  store.commit('setOpenAdmin', false);
  store.commit('setIsAdding', false);
  store.commit('setIsSearching', false);
  store.commit('setIsJoining', false);
  store.commit('setIsDM', false);
  store.commit('setRoomList', []);
  store.commit('setRoom', { roomId: '', leftName: '', rightName: '', roomMode: false });
  store.commit('setUserInviteList', { userInviteList: [] });
  store.commit('setInviteFriendId', 0);
  store.commit('setInviteFriendName', '');
  store.commit('setUser', { id: 0, name: '', nickname: '', email: '', profileUrl: '',
    need2fa: false, is2fa: false, isBanned: false, status: '', following: [], blocking: [] });
  try { localStorage.removeItem('token'); } catch { /* A blocked storage API must not retain live sockets. */ }
  delete axios.defaults.headers.common.Authorization;
}

let pendingLogout: Promise<{ serverConfirmed: boolean }> | undefined;
/** Remote logout is attempted first; an unavailable server cannot trap this tab. */
export function logoutSession(): Promise<{ serverConfirmed: boolean }> {
  if (pendingLogout) return pendingLogout;
  pendingLogout = (async () => {
    let serverConfirmed = false;
    try {
      await axios.get('/auth/logout', { timeout: 5000 });
      serverConfirmed = true;
    } catch { /* The login page explicitly reports that remote logout was unconfirmed. */ }
    finally { clearLocalSession(); }
    return { serverConfirmed };
  })().finally(() => { pendingLogout = undefined; });
  return pendingLogout;
}

export function openFriends(): void { store.commit('setOpenFriends', true); }
