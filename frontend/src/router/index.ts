import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import LoginView from '@/views/LoginView.vue'
import TfaView from '@/views/TfaView.vue'
import ChatView from '@/views/ChatView.vue'
import GameView from '@/views/GameView.vue'
import InfoView from '@/views/InfoView.vue'
import BoardView from '@/views/BoardView.vue'
import SpectateView from '@/views/SpectateView.vue'
import InviteGameView from '@/views/InviteGameView.vue'
import TempGamePage from '@/views/tempPage/TempGamePage.vue'
import TempWatchPage from '@/views/tempPage/TempWatchPage.vue'
import TempInvitePage from '@/views/tempPage/TempInvitePage.vue'
import TempChat from '@/views/tempPage/TempChat.vue'

import store from "@/store/index"
import axios from 'axios'
import io from 'socket.io-client'

// import { nextTick } from 'vue';

import { useCookies } from "vue3-cookies";
const { cookies } = useCookies();

function lazyLoad(view : any){
  return() => import(`@/views/${view}.vue`)
}

function getAuthToken() {
  return localStorage.getItem('token');
}

function setAuthorizationHeader() {
  const token = getAuthToken();
  if (token)
    axios.defaults.headers.common['Authorization'] = 'Bearer ' + token;
}

function clearAuthToken() {
  localStorage.removeItem("token");
  delete axios.defaults.headers.common['Authorization'];
}

function getErrorStatus(error: any) {
  return error?.response?.status;
}

function needsNickname(user: any) {
  return user.id > 0 && (user.nickname == null || user.nickname == '');
}

function getLoginDestination(user: any) {
  if (needsNickname(user))
    return { name: 'info' };
  if (user.id != 0 && user.nickname != null)
    return { name: 'home' };
  return null;
}

async function fetchCurrentUser() {
  setAuthorizationHeader();
  const res = await axios.get('/user/me');
  store.commit('setUser', res.data);
  return res.data;
}

async function updateUserStatus(value: string) {
  try {
    setAuthorizationHeader();
    await axios.patch("/user/status", {value: value});
    return null;
  } catch (error) {
    const status = getErrorStatus(error);
    if(status == 401)
    {
      clearAuthToken();
      return { name: 'login' };
    }
    else if(status == 403)
      return { name: 'tfa' };
    console.log(error);
    return null;
  }
}

async function login_check()
{
  try {
    const user = await fetchCurrentUser();
    return getLoginDestination(user);
  } catch (error) {
    const status = getErrorStatus(error);
    if(status == 401)
    {
      clearAuthToken();
      return { name: 'login' };
    }
    else if(status == 403)
      return { name: 'tfa' };
    console.log(error);
    return null;
  }
}
async function error_check(toName: any)
{
  try {
    const user = await fetchCurrentUser();
    if(user.id > 0 && user.status == 'offline')
    {
      const destination = await updateUserStatus('online');
      if (destination)
        return destination;
      user.status = 'online';
      store.commit('setUser', user);
    }

    if (needsNickname(user) && toName != 'info')
      return { name: 'info' };
    return null;
  } catch (error) {
    const status = getErrorStatus(error);
    if(status == 401)
    {
      clearAuthToken();
      return { name: 'login' };
    }
    else if(status == 403)
    {
      if (toName != 'tfa')
        return { name: 'tfa' };
      return null;
    }
    console.log(error);
    return null;
  }
}
async function match_check()
{
  try {
    setAuthorizationHeader();
    const res = await axios.get('/user/match');
    store.commit('setMatch', res.data);
    return await updateUserStatus('online');
  } catch (error) {
    const status = getErrorStatus(error);
    if(status == 401)
    {
      clearAuthToken();
      return { name: 'login' };
    }
    else if(status == 403)
      return { name: 'tfa' };
    console.log(error);
    return null;
  }
}

function connectSocket(toName: any) {
  if (store.getters.socket == null && (toName == 'chat' || toName == 'tempchat')) {
    store.commit("setSocket", io(`ws://${process.env.VUE_APP_SERVER_IP}:${process.env.VUE_APP_BACKEND_PORT}/chat`, {
    transports: ['websocket'],
    auth:
    {
      token: getAuthToken()
    }
    }))
  }
  else if (store.getters.gameSocket == null &&
      (toName == 'game' || toName == 'tempgamepage'
      || toName == 'invite' ||toName == 'tempinvitepage'
      || toName == 'spectate' || toName == 'tempwatchpage'))
  {
    const gameSocket = io(`ws://${process.env.VUE_APP_SERVER_IP}:${process.env.VUE_APP_BACKEND_PORT}/game`, {
      transports: ['websocket'],
      auth:
      {
        token: getAuthToken()
      }
    });
    store.commit("setGameSocket", gameSocket)
  }
}

async function updateRouteStatus(toName: any) {
  if ((store.getters.userstatus == 'online') && ( toName == 'game' || toName == 'invite' || toName == 'spectate'))
    return await updateUserStatus('ingame');
  else if ((store.getters.userstatus == 'ingame')  && (toName == 'home' || toName == 'chat' || toName == 'tfa' || toName == 'board' || toName == 'info'))
    return await updateUserStatus('online');
  return null;
}

const routes: Array<RouteRecordRaw> = [
	{
    path: '/',
    name: 'home',
    // component: HomeView,
    component: lazyLoad('HomeView'),

  },
  {
    path: '/game',
    name: 'game',
    // component: GameView,
    component: lazyLoad('GameView'),
    // beforeEnter: (to, from, next) => {
    //   error_check();
    // }
  },
  {
    path: '/tempgamepage',
    name: 'tempgamepage',
    component: TempGamePage
  },
	{
    path: '/tempchat',
    name: 'tempchat',
    component: TempChat
  },
	{
    path: '/tempwatchpage',
    name: 'tempwatchpage',
    component: TempWatchPage
  },
	{
    path: '/tempinvitepage',
    name: 'tempinvitepage',
    component: TempInvitePage
  },
	{
    path: '/login',
    name: 'login',
    component: LoginView
  },
	{
    path: '/tfa',
    name: 'tfa',
    // component: TfaView,
    component: lazyLoad('TfaView'),

  },
	{
    path: '/chat',
    name: 'chat',
    // component: ChatView,
    component: lazyLoad('ChatView'),
    // beforeEnter: (to, from, next) => {
      // error_check();
    // }
  },
	{
    path: '/spectate',
    name: 'spectate',
    component: SpectateView,
  },
  {
    path: '/info',
    name: 'info',
    // component: InfoView,
    component: lazyLoad('InfoView'),

  },
  {
    path: '/board',
    name: 'board',
    // component: BoardView,
    component: lazyLoad('BoardView'),

  },
	{
    path: '/invite',
    name: 'invite',
    component: InviteGameView
  },
  {
		path: '/:catchAll(.*)',
		redirect: '/',
	},
]

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes
})

router.beforeEach(async (to, from, next) => {
  if (to.name === 'login')
  {
    if(to.query.token)
    {
      const token = cookies.get('token');
      if(token != null)
      {
        localStorage.removeItem('token');
        localStorage.setItem('token', token);
      }
      cookies.remove('token');

      if (!getAuthToken())
        return next({ name: 'login' });

      setAuthorizationHeader();
      const statusDestination = await updateUserStatus('online');
      if (statusDestination)
        return next(statusDestination);

      const destination = await login_check();
      if (destination && destination.name != 'login')
        return next(destination);
      return next({ name: 'login' });
    }

    if (!getAuthToken())
      return next();

    const destination = await login_check();
    if (destination && destination.name != 'login')
      return next(destination);
    return next();
  }
	else
  {
    if (!getAuthToken())
      return next({ name: 'login' });

    if (to.name == 'board')
    {
      const authDestination = await error_check(to.name);
      if (authDestination)
        return next(authDestination);

      const matchDestination = await match_check();
      if (matchDestination)
        return next(matchDestination);
    }
    else
    {
      const authDestination = await error_check(to.name);
      if (authDestination)
        return next(authDestination);
    }

    connectSocket(to.name);

    const routeStatusDestination = await updateRouteStatus(to.name);
    if (routeStatusDestination)
      return next(routeStatusDestination);

    return next();
  }
})

export default router
