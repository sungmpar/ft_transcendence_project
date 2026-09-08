<template>
	<div class="chat-layout w-full flex">
		<div class="chat-channels flex">
		<ChannelBar />
		</div>
		<div class="chat-messages flex flex-auto">
		<ChatContainer />
		</div>
		<JoinChannelModal />
		<SearchChannelSlider />
		<AddChannelModal />
		<ProfileSlider />
		<AdminSlider />
	</div>
</template>

<script setup lang="ts">
import ChannelBar from '@/components/chat/ChannelBar.vue';
import ChatContainer from '@/components/chat/ChatContainer.vue';
import SearchChannelSlider from '@/components/chat/SearchChannelSlider.vue';
import AddChannelModal from '@/components/chat/AddChannelModal.vue';
import ProfileSlider from '@/components/ProfileSlider.vue';
import AdminSlider from '@/components/chat/AdminSlider.vue';
import store from "@/store"
import JoinChannelModal from '@/components/chat/JoinChannelModal.vue';

import { useRoute } from 'vue-router';
import { onMounted, onUnmounted, watch } from 'vue';
import axios from 'axios';

const route = useRoute();
watch(() => route, () => {
	chatFriend();
}, {
  deep: true
})

function chatFriend(){
	if (route.params.friendId) {
	const channel = store.getters.users.find((user: any) => {
		console.log("incoming user", user)
		return user.id == route.params.friendId;
	});
	if (channel) {
				store.commit("setChannel", channel);
				console.log("channel ? ", channel);
				console.log("socket: ", store.getters.socket);
				store.getters.socket.emit("join-dm", {
				userId: store.getters.userid,
				otherUserId: channel.id,
			});
			store.getters.socket.emit("all-direct-message", {
				userId: store.getters.userid,
				otherUserId: channel.id,
			});
			store.commit("setIsDM", true);
		}
	}
}


if (store.getters.channel.id !== null) {
	console.log("channel id: ", store.getters.channel.id);

}

store.getters.socket.on("user-list", (data: any) => {
	console.log("user list: ", data);
	store.commit("setUsers", data)
	console.log("set users: " + store.getters.users)
});

store.getters.socket.on("channel-list", (data: any) => {
	store.commit("setChannels", data)
	console.log("set channels: " + store.getters.channels)
});

store.getters.socket.on("message", (data: any) => {
	console.log("received message . . . ", data);
	store.commit("addChannelMessage", data)
		setTimeout(() => {
			const scroller = document.getElementById('msgContainer');
			if (scroller) {
          scroller.scrollTop = scroller.scrollHeight;
        }}, 100);
});

store.getters.socket.on("direct-message", (data: any) => {
	console.log("received direct message . . . ", data);
	store.commit("addDirectMessage", data)
		setTimeout(() => {
			const scroller = document.getElementById('msgContainer');
			if (scroller) {
          scroller.scrollTop = scroller.scrollHeight;
        }}, 100);
});

store.getters.socket.on("error", (data: any) => {
	alert(data);
	return;
});

store.getters.socket.on("notify", (data: any) => {
	alert(data);
	return;
});

onMounted(() => {
	chatFriend();
});

onUnmounted(() => {
	if (store.getters.socket != null){
		store.getters.socket.close();
		store.commit("setSocket", null);
	}
});

</script>

<style scoped>
/* Keep the existing chat handlers; each pane owns its width and scrolling. */
.chat-layout { min-width: 0; }
.chat-channels { flex: 0 0 320px; min-width: 0; }
.chat-messages { flex: 1; min-width: 0; }
.chat-messages :deep(.chat-composer) { width: 100%; padding: 0 16px 16px; gap: 8px; flex-shrink: 0; }
.chat-messages :deep(.chat-composer .normal-button) { flex: 0 0 auto; margin: 0; padding: 12px 16px; }
.chat-messages :deep(.bottom-bar) { flex: 1; min-width: 0; margin: 0; }
.chat-messages :deep(.bottom-bar-input) { min-width: 0; margin-left: 0; margin-right: 0; }
@media (max-width: 800px) {
  .chat-layout { flex-direction: column; }
  .chat-channels { flex: none; width: 100%; }
  .chat-channels :deep(.channel-bar) { width: 100%; height: auto; max-height: 40vh; overflow: auto; }
  .chat-messages { width: 100%; }
  .chat-messages :deep(.chat-container) { height: 70vh; min-height: 360px; }
}
</style>
