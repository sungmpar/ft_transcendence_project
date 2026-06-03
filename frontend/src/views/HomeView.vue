<template>
	<div class = "bg-gray-800 w-full h-screen">
		<div class="top-0 right-0 bottom-0 left-20">
			<div class="flex justify-center" style="position: absolute; right: 0px; bottom: 0px;">
				<button class="gray-button" type="button" @click="logout">
					Logout
				</button>
			</div>
			<div class="flex rounded-lg bg-gradient-to-r from-purple-400 via-violet-600  to-purple-700 animate-gradient-x px-3 pt-0 pb-2 mb-2">
				<div class="flex flex-row text-3xl mt-2 px-2 pt-4 pb-2 mb-2">
					<p class="drop-shadow-lg font-extrabold text-black-700 ">PING &nbsp;</p>
					<p class="drop-shadow-lg font-extrabold text-black-700">&nbsp;P</p>
					<img src="../assets/pong.png" class="drop-shadow-lg animate-bounce h-8 pt-2">
					<p class="drop-shadow-lg font-extrabold text-black-700">NG</p>
				</div>
				<div class="ml-auto pt-8">
					<p class="text-gray-400 drop-shadow-lg font-bold">{{ store.getters.usernickname }}</p>
				</div>
				<div class="ml-3 px-1" v-if="store.getters.userid != 0">
					<img :src="get_avatar(store.getters.userid)" class=" object-contain h-20 w-20 pt-2"/>
				</div>
			</div>
		</div>
	</div>
	</template>

<script setup lang="ts">

import router from '@/router';
import store from '@/store';
import axios from 'axios';

const backendBaseUrl = process.env.VUE_APP_BACKEND_URL || window.location.origin

async function logout() {
	await axios.get('/auth/logout')
	.then((response) => {
		console.log(response);
	})
	.catch((error) => {
		console.log(error);
	});
	localStorage.removeItem("token");
	router.push("/login");
}

function get_avatar(str :string) {
	return (`${backendBaseUrl}/user/image/`+ str);
}

</script>
