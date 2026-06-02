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

async function login_check()
{
  axios.defaults.headers.common['Authorization'] = 'Bearer ' + localStorage.getItem('token');

  await axios.get('/user/me')
  .then(res => {
    store.commit('setUser', res.data);
    if(store.state.user.id > 0 && (store.state.user.nickname == null || store.state.user.nickname == ''))
      router.push('/info');
    else if(store.state.user.id != 0 && store.state.user.nickname != null)
      router.push('/');
  })
  .catch(error => {
    if(error.response.status == 401)
    {
      router.push('/login');
    }
    else if(error.response.status == 403)
    {
      router.push('/tfa');
    }
    console.log(error);
  });

}
async function error_check()
{
  axios.defaults.headers.common['Authorization'] = 'Bearer ' + localStorage.getItem('token');

  await axios.get('/user/me')
  .then(res => {
    store.commit('setUser', res.data);
    if(store.state.user.id > 0 && store.state.user.status == 'offline')
    {
      alert("로그아웃 되었습니다. 다시 로그인해주세요. [2]");
      localStorage.removeItem("token");
      router.push('/login');
    }
    else if (store.state.user.id > 0 && (store.state.user.nickname == null || store.state.user.nickname == ''))
    {
      router.push('/info');
      // alert("닉네임을 입력 해주세요. [4]");
    }
  })
  .catch(error => {
    if(error.response.status == 401)
    {
			alert("유효한 token이 없습니다. 다시 로그인해주세요. [1]");
      localStorage.removeItem("token");
      router.push('/login');
    }
    else if(error.response.status == 403)
    {
      router.push('/tfa');
    }
    console.log(error);
  })
}
async function match_check()
{
  axios.defaults.headers.common['Authorization'] = 'Bearer ' + localStorage.getItem('token');

  await axios.get('/user/match')
  .then(res => { store.commit('setMatch', res.data);})
  .catch(error => {
    if(error.response.status == 401)
    {
			localStorage.removeItem("token");
      router.push('/login');
			alert("유효한 token이 없습니다. 다시 로그인해주세요. [3]");
    }
    else if(error.response.status == 403)
    {
      router.push('/tfa');
    }
    console.log(error);
  })
  await axios.patch("/user/status", {value: "online"});
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

router.beforeEach((to, from, next) => {
  if (to.name === 'login')
  {
    if(to.query.token)
    {
      if(cookies.get('token') != null)
      {
        localStorage.removeItem('token');
        localStorage.setItem('token', cookies.get('token'));
        axios.defaults.headers.common['Authorization'] = 'Bearer ' + localStorage.getItem('token');
				axios.patch("/user/status", {value: "online"});
      }
      cookies.remove('token');
      login_check();
      // router.push('/');
    }
    else
      login_check();
  }
  // else if (to.name === 'board')
  // {
  //   error_check();
  //   match_check();
  // }
	else
  {
    error_check();

    if (to.name == 'board')
      match_check();

    // if (localStorage.getItem('token') === null)
		// 	router.push('/login')

    if (localStorage.getItem('token'))
    {
			if (store.getters.socket == null && (to.name == 'chat' || to.name == 'tempchat')) {
				store.commit("setSocket", io('ws://:5000/chat', {
				transports: ['websocket'],
				auth:
				{
					token: localStorage.getItem('token')
				}
				}))
			}
			else if (store.getters.gameSocket == null &&
					(to.name == 'game' || to.name == 'tempgamepage'
					|| to.name == 'invite' ||to.name == 'tempinvitepage'
					|| to.name == 'spectate' || to.name == 'tempwatchpage'))
      {
				const gameSocket = io('ws://:5000/game', {
					transports: ['websocket'],
					auth:
					{
						token: localStorage.getItem('token')
					}
				});
				store.commit("setGameSocket", gameSocket)
			}
		}

		if ((store.getters.userstatus == 'online') && ( to.name == 'game' || to.name == 'invite' || to.name == 'spectate'))
    {
      axios.patch("/user/status", {value: "ingame"});
		}

    else if ((store.getters.userstatus == 'ingame')  && (to.name == 'home' || to.name == 'chat' || to.name == 'tfa' || to.name == 'board' || to.name == 'info'))
    {
			axios.patch("/user/status", {value: "online"});
		}

  }
  next()
})

export default router
