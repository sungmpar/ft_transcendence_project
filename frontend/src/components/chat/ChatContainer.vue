<template>
	<div className='chat-container'>
		<div class="top-navigation">
			<h5 className='title-text'>{{ channel.name }}</h5>
		</div>
		<div className='content-list mt-4' id="msgContainer">
				<MessageBubble v-for="message in channel.messages" :key="message" :userId="message.userId" :userName="message.userName" :message="message.message"/>
		</div>
		<div class="chat-composer flex items-center w-11/12">
			<div class='bottom-bar'>
				<input type='text' placeholder='Enter message...' class='bottom-bar-input' v-model="userText"/>
			</div>
			<button class="flex-auto normal-button" @click="sendMessage">Send</button>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue"
import store from "@/store";
import MessageBubble from "./MessageBubble.vue";

const channel = computed(() => store.getters.channel ?? {});
const userText = ref("");

function sendMessage() {
	if (store.getters.isDM == true) {
		store.getters.socket.emit("direct-message", {
			userId: store.getters.userid,
			otherUserId: channel.value.id,
			message: userText.value,
		});
	} else {
		store.getters.socket.emit("message", {
		channel: channel.value.id,
		message: userText.value,
		});
	}
	userText.value = "";
}

</script>
