<template>
	<div class="w-full flex">
		<div class="flex">
		<ChannelBar />
		</div>
		<div class="flex flex-auto">
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
