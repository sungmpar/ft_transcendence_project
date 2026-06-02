<template>
<div class="fixed top-0 left-0 h-screen w-20 m-0 flex flex-col bg-gray-900 text-white shadow">
	<div class="my-2">
		<div>
			<p class="py-3 text-center text-sm font-bold">{{store.getters.usernickname}}</p>
		</div>

		<div>
			<router-link to="/">
				<div class="sidebar-icon group">
					<font-awesome-icon icon="fa-solid fa-home" />
					<span class="sidebar-tooltip group-hover:scale-100">home</span>
				</div>
			</router-link>
		</div>

		<div>
			<router-link to="/tempchat">
				<hr class="sidebar-hr" />
					<div class="sidebar-icon group">
					<font-awesome-icon icon="fa-solid fa-comment" />
					<span class="sidebar-tooltip group-hover:scale-100">chat</span>
				</div>
			</router-link>
		</div>

		<div>
			<div class="sidebar-icon group" @click="openFriends">
				<font-awesome-icon icon="fa-solid fa-user-group" />
				<span class="sidebar-tooltip group-hover:scale-100">friends</span>
			</div>
		</div>

		<div>
			<router-link to="/game">
				<hr class="sidebar-hr" />
				<div class="sidebar-icon group">
					<font-awesome-icon icon="fa-solid fa-table-tennis-paddle-ball" />
					<span class="sidebar-tooltip group-hover:scale-100">game</span>
				</div>
			</router-link>
		</div>

		<div>
			<router-link to="/tempinvitepage">
				<div class="sidebar-icon group">
					<font-awesome-icon icon="fa-solid fa-handshake" />
					<span class="sidebar-tooltip group-hover:scale-100">invite</span>
				</div>
			</router-link>
		</div>
		<div>
			<router-link to="/tempwatchpage">
				<div class="sidebar-icon group">
					<font-awesome-icon icon="fa-solid fa-video-camera" />
					<span class="sidebar-tooltip group-hover:scale-100">spectate</span>
				</div>
			</router-link>
		</div>

		<div><router-link to="/info">
			<hr class="sidebar-hr" />
			<div class="sidebar-icon group">
			<font-awesome-icon icon="fa-solid fa-user-large" />
			<span class="sidebar-tooltip group-hover:scale-100">info</span>
			</div></router-link>
		</div>

		<div><router-link to="/board">
			<hr class="sidebar-hr" />
			<div class="sidebar-icon group">
			<font-awesome-icon icon="fa-solid fa-list" />
			<span class="sidebar-tooltip group-hover:scale-100">leader board</span>
			</div></router-link>
		</div>

		<div><router-link to="/tfa">
			<hr class="sidebar-hr" />
			<div class="sidebar-icon group">
			<font-awesome-icon icon="fa-solid fa-lock" />
			<span class="sidebar-tooltip group-hover:scale-100">2FA</span>
			</div></router-link>
		</div>



	</div>
</div>
</template>

<script setup lang="ts">
import store from '@/store';
import axios from 'axios';
import {onUnmounted} from 'vue';

const link = `http://${process.env.VUE_APP_SERVER_IP}:${process.env.VUE_APP_FRONTEND_PORT}`
async function openFriends() {
	store.commit('setOpenFriends', true);
	console.log('openFriends' + store.state.openFriends);
	await axios.get('/user/friends').then(
	(response) => {
		store.commit('setFriends', response.data);
	});
}

</script>
