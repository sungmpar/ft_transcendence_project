import { createStore } from 'vuex';
import User from '@/interfaces/User';
import axios from 'axios';
import type { GameState as CoreGameState } from '../../../shared/game-core';

const store = createStore({
  state: {
		match: [],

		user: <User>{
			id: 0,
			name: '',
			nickname: '',
			email: '',
			profileUrl: '',
			need2fa: false,
			is2fa: false,
			isBanned: false,
			status: '',
			following: [],
			blocking: [],
		},

		// friends state
		openFriends: false,
		friends: [],

		roomList: [],

		// channel state
		socket: <null | any>(null),
		channels: [],
		allChannels: [],
		users: [],
		channel: {
			id: null,
			name: '',
			messages: []
		},
		isAdding: false,
		isSearching: false,
		isJoining: false,
		isDM: false,
		openProfile: false,
		openAdmin: false,
		joinChannel: {
			name: '',
			isPrivate: false,
			password: '',
		},
		//game state
		gameSocket: <null | any>(null),

		// profile state
		profileUser: {},

		// game room state
		room: {
			roomId: "",
			leftName: "",
			rightName: "",
			mode: false,
		},

		gameData: {
			ball: {x: 0, y: 0},
			leftPlayer: {x: 0, y: 0, power: false},
			rightPlayer: {x: 0, y: 0, power: false},
			score: {left: 0, right: 0},
		},

		inviteFriendId: 0,

		inviteFriendName: "",

		mode: true,
		onlineState: null as CoreGameState | null,
		onlineMetrics: { ackRoundTripMs: null as number | null, transportRoundTripMs: null as number | null, snapshots: 0, inputMessages: 0, fps: 0, bufferDepth: 0, displayDelayMs: 0, underflows: 0 },

		userInviteList: [],
	},
	getters: {
		usermatch: function (state) { return state.match },
		userid: function (state) { return state.user.id },
		usernickname: function (state) { return state.user.nickname },
		useris2fa: function (state) { return state.user.is2fa },
		userneed2fa: function (state) { return state.user.need2fa },
		userstatus: function (state) { return state.user.status },

		// friends getters
		openFriends: state => state.openFriends,
		friends: state => state.friends,

		// channel getters
		socket: state => state.socket,
		channels: state => state.channels,
		allChannels: state => state.allChannels,
		users: state => state.users,
		channel: state => state.channel,
		isAdding: state => state.isAdding,
		isSearching: state => state.isSearching,
		isJoining: state => state.isJoining,
		isDM: state => state.isDM,
		openProfile: state => state.openProfile,
		openAdmin: state => state.openAdmin,
		joinChannel: state => state.joinChannel,
		profileUser: state => state.profileUser,

		gameSocket: state => state.gameSocket,

		room: state => state.room,
		gameData: state => state.gameData,

		roomList: state => state.roomList,

		mode: state => state.mode,
		onlineState: state => state.onlineState,
		onlineMetrics: state => state.onlineMetrics,

		inviteFriendId: state => state.inviteFriendId,
		inviteFriendName: state => state.inviteFriendName,

		userInviteList: state => state.userInviteList,
	},
	mutations: {
		setMatch: (state, payload) => {state.match = payload},
		// login mutations
		setUser: (state, payload) => {
      state.user.id = payload.id
			state.user.name = payload.name
			state.user.nickname = payload.nickname
			state.user.email = payload.email
			state.user.profileUrl = payload.profileUrl
			state.user.need2fa = payload.need2fa
			state.user.is2fa = payload.is2fa
			state.user.isBanned = payload.isBanned
			state.user.status = payload.status
			state.user.following = payload.following
			state.user.blocking = payload.blocking
    },
		// friends mutations
		setOpenFriends: (state, payload) => state.openFriends = payload,
		setFriends: (state, payload) => state.friends = payload,

		// friends mutations
		setRoomList: (state, payload) => state.roomList = payload,

		// channel mutations
		setSocket: (state, payload) => state.socket = payload,
		setChannels: (state, payload) => state.channels = payload,
		setAllChannels: (state, payload) => state.allChannels = payload,
		setUsers: (state, payload) => state.users = payload,
		setChannel: (state, payload) => state.channel = payload,
		setIsAdding: (state, payload) => state.isAdding = payload,
		setIsSearching: (state, payload) => state.isSearching = payload,
		setIsJoining: (state, payload) => state.isJoining = payload,
		setOpenProfile: (state, payload) => state.openProfile = payload,
		setOpenAdmin: (state, payload) => state.openAdmin = payload,
		setJoinChannel: (state, payload) => state.joinChannel = payload,
		setIsDM: (state, payload) => state.isDM = payload,
		loadChannelMessage: (state, payload) => {
			state.channels.forEach((channel: any) => {
				if (channel.id === payload.channel) {
					channel.messages = []
					payload.messages.forEach((message: any) => {
						channel.messages.push({userId: message.userId, userName: message.userName, message: message.message});
					});
				}
			});
		},
		loadDirectMessage: (state, payload) => {
			state.users.forEach((channel: any) => {
				if (channel.id === payload.channel) {
					channel.messages = []
					payload.messages.forEach((message: any) => {
						channel.messages.push({userId: message.userId, userName: message.userName, message: message.message});
					});
				}
			});
		},
		addChannelMessage: (state, payload) => {
			state.channels.forEach((channel: any) => {
				if (channel.id === payload.channel) {
					if (channel.messages === undefined) {
						channel.messages = [];
					}
					//channel.messages.push({userId: payload.userId, userName: payload.userName, message: payload.message});
					if (state.channel.id === payload.channel && state.isDM == false) {
						store.getters.channel.messages.push({userId: payload.userId, userName: payload.userName, message: payload.message});
					}
				}
			});
		},
		addDirectMessage: (state, payload) => {
			console.log("dm", payload);
			state.users.forEach((user: any) => {
				if (user.id === payload.channel) {
					if (user.messages === undefined) {
						user.messages = [];
					}
					//user.messages.push({userId: payload.userId, userName: payload.userName, message: payload.message});
					console.log("dm now")
					if (state.channel.id === payload.channel && state.isDM == true) {
						store.getters.channel.messages.push({userId: payload.userId, userName: payload.userName, message: payload.message});
					}
				}
			});
		},

		setProfileUser: (state, payload) => state.profileUser = payload,

		setGameSocket: (state, payload) => state.gameSocket = payload,
		setOnlineState: (state, payload: CoreGameState | null) => state.onlineState = payload,
		setOnlineMetrics: (state, payload) => state.onlineMetrics = { ...state.onlineMetrics, ...payload },

		setRoom: (state, payload) => {
			state.room.mode = payload.roomMode === true
      state.room.roomId = payload.roomId
			state.room.leftName = payload.leftName
			state.room.rightName = payload.rightName
		},
		setGameData: (state, payload) => {
			state.gameData.ball.x = payload.ball.x;
			state.gameData.ball.y = payload.ball.y;
			state.gameData.leftPlayer.x = payload.leftBar.x;
			state.gameData.leftPlayer.y = payload.leftBar.y;
			state.gameData.leftPlayer.power = payload.leftBar.power;
			state.gameData.rightPlayer.power = payload.rightBar.power;
			state.gameData.rightPlayer.x = payload.rightBar.x;
			state.gameData.rightPlayer.y = payload.rightBar.y;
			state.gameData.score.left = payload.score.left;
			state.gameData.score.right = payload.score.right;
		},
		setRoomData: (state, payload) => {
			state.room.leftName = payload.leftName;
			state.room.rightName = payload.rightName;
			state.gameData.score.left = payload.leftScore;
			state.gameData.score.right = payload.rightScore;
		},
		setSpecData: (state, payload) => {
			state.room.roomId = payload.roomId;
			state.room.leftName = payload.leftName;
			state.room.rightName = payload.rightName;
			state.gameData.score.left = 0;
			state.gameData.score.right = 0;
		},
		setMode(state, payload) {
			state.mode = payload;
		},
		setInviteFriendId: (state, payload) => state.inviteFriendId = payload,
		setInviteFriendName: (state, payload) => state.inviteFriendName = payload,

		setUserInviteList: (state, payload) => state.userInviteList = payload.userInviteList,
	},
  actions: {
		setMatch({ commit } , payload) {
			axios.get("user/match")
			.then(res => { commit('setUser', res.data);})
			.catch(error => {console.error(error);});
		},
		// login actions
		setUser({ commit }, payload) {
			axios.get("user/me")
			.then(res => { commit('setUser', res.data);})
			.catch(error => {console.error(error);});
			// console.log(store.state.user);
			// commit('setUser', payload);
		},
		setAllChannels({ commit }, payload) {
			commit('setAllChannels', payload);
		},
  }
})

export default store;
