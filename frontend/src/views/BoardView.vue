<template>
	<div class = "bg-gray-800 w-full h-screen">
		<div class="top-0 right-0 bottom-0 left-20">
			<div class="flex rounded-lg bg-gradient-to-r from-purple-400 via-violet-600  to-purple-700 animate-gradient-x px-3 pt-0 pb-2 mb-2">
				<div class="flex flex-row text-3xl mt-2 px-2 pt-4 pb-2 mb-2">
					<p class="drop-shadow-lg font-extrabold text-black-700 ">Leader &nbsp;</p>
					<p class="drop-shadow-lg font-extrabold text-black-700">&nbsp;B</p>
					<img src="../assets/pong.png" class="drop-shadow-lg animate-bounce h-8 pt-2">
					<p class="drop-shadow-lg font-extrabold text-black-700 ">ard</p>
			</div>
				<div class="ml-auto pt-8">
					<p class="text-gray-400 drop-shadow-lg font-bold">{{ store.getters.usernickname }}</p>
				</div>
				<div class="ml-3 px-1" v-if="store.getters.userid != 0">
					<img :src="get_avatar(store.getters.userid)" class=" object-contain h-20 w-20 pt-2"/>
				</div>
			</div>
			<div class="flex flex-col rounded-lg bg-gradient-to-r from-purple-400 via-violet-600  to-purple-700 animate-gradient-x px-8 pt-6 pb-8 mb-4">
				<table class="table-fixed text-center divide-y divide-gray-200 dark:divide-gray-700" >
					<thead>
						<tr>
							<th class="pb-3 font-bold text-xl w-1/12">Avatar</th>
							<th class="pb-3 font-bold text-xl w-2/12 text-orange-400">Nickname</th>
							<th class="pb-3 font-bold text-xl w-2/12">1v1 games</th>
							<th class="pb-3 text-blue-400 font-extrabold text-xl w-1/12">Wins</th>
							<th class="pb-3 text-amber-400 font-extrabold text-xl w-1/12">Losses</th>
							<th class="pb-3 text-green-400 font-extrabold text-xl w-2/12">Ladder Level</th>
							<th class="pb-3 font-bold text-xl w-2/12">Achievements</th>
						</tr>
					</thead>
					<tbody class="text-center items-center divide-y divide-gray-300">
						<tr v-for="obj in store.getters.usermatch" v-bind:key="obj.id">
							<td class="pt-5 pb-5" >
								<img :src="get_avatar(obj.id)" class="object-contain w-20 mx-auto" @error="defaultImage">
							</td>
							<td class="font-bold text-xl w-2/12 text-orange-400" @click="openModal(obj.id)">
								{{ obj.nickname }}
							</td>
							<div class=" text-left text-white font-extrabold">
								<pre><td><br>{{ obj.match.toString().replace(/,/g, '\n')}}</td><br></pre>
							</div>
							<td class="text-blue-400 font-extrabold text-xl">
								{{ obj.won }}
							</td>
							<td class="text-amber-400 font-extrabold text-xl">
								{{ obj.lost }}
							</td>
							<td class="text-green-400 font-extrabold text-xl">
								{{ obj.ladder }}
							</td>
							<div class="text-left text-white font-extrabold">
								<pre><br><td>{{ obj.achievement.toString().replace(/,/g, '\n')}}</td><br></pre>
							</div>
						</tr>
					</tbody>
				</table>
			</div>
			<ProfileSlider />
		</div>
	</div>
</template>

<script setup lang="ts">
import axios from 'axios';
import { defineComponent } from "vue";
import store from '../store';
import { onMounted, onUnmounted } from 'vue';
import ProfileSlider from '../components/ProfileSlider.vue';

let input_text = '';
let image = '';
let file = '';
let users = store.getters.usermatch;
const backendBaseUrl = process.env.VUE_APP_BACKEND_URL || window.location.origin

function defaultImage(event :Event) {
	(event.target as HTMLInputElement).src = require('../assets/dafault.jpeg');
}

async function goTomain(){
	var url = `${window.location.origin}/`;
	document.location = url;
}

function get_avatar(str :string) {
	return (`${backendBaseUrl}/user/image/`+ str);
}

function my_name(){
	return store.getters.usernickname;
}

function get_upload_img_url(){
	return image;
}

async function openModal(userId: number) {
	await axios.get('/user/' + userId).then((response) => {
		store.commit('setProfileUser', response.data);
		console.log(response.data);
	});
	store.commit("setOpenProfile", true);
	console.log("open profile: " + store.getters.openProfile);
}

</script>
