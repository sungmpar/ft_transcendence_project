<template>
	<div class="message">
		<div className='avatar-wrapper' @click="openModal(userId)">
			<img :src="get_avatar(userId)" alt='' classe='avatar'/>

		</div>
		<div className='message-content'>
      <p className='message-owner'>
        {{ userName }}
      </p>
      <p className='message-text'>{{ message }}</p>
    </div>
  </div>
</template>


<script setup lang="ts">
import store from '@/store';
import axios from 'axios';
import { defineProps } from 'vue';

const backendBaseUrl = process.env.VUE_APP_BACKEND_URL || window.location.origin

defineProps({
	userId: {
		type: Number,
		required: true,
	},
	userName: {
		type: String,
		required: true,
	},
  message: {
		type: String,
		required: true,
	},
})

async function openModal(userId: number) {
	await axios.get('/user/' + userId).then((response) => {
		store.commit('setProfileUser', response.data);
		console.log(response.data);
	});
	store.commit("setOpenProfile", true);
	console.log("open profile: " + store.getters.openProfile);
}

function get_avatar(id: number) {
	return (`${backendBaseUrl}/user/image/${id}`);
}

</script>
