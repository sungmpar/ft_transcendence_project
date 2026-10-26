<template>
	<p v-if="connectionNotice" role="status" class="bg-slate-700 p-3 text-white">{{ connectionNotice }}</p>
	<section v-if="notifications.length" aria-label="채팅 알림" class="chat-notifications">
		<div v-for="notice in notifications" :key="notice.id"
			:role="notice.kind === 'error' ? 'alert' : 'status'"
			:class="['chat-notice', { 'chat-notice-error': notice.kind === 'error' }]">
			<p>{{ notice.message }}</p>
			<button type="button" aria-label="알림 닫기" @click="dismissNotification(notice.id)">닫기</button>
		</div>
	</section>
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
import { onMounted, onUnmounted, ref, watch } from 'vue';

const route = useRoute();
const connectionNotice = ref('');
const notifications = ref<Array<{ id: number; kind: 'error' | 'notify' | 'leave'; message: string }>>([]);
let nextNotificationId = 0;
const notificationSocket = store.getters.socket;

function showNotification(kind: 'error' | 'notify' | 'leave', message: string) {
	notifications.value.push({ id: ++nextNotificationId, kind, message });
}

function dismissNotification(id: number) {
	notifications.value = notifications.value.filter((notice) => notice.id !== id);
}

const onChatError = (message: string) => showNotification('error', message);
const onChatNotify = (message: string) => showNotification('notify', message);
const onChatLeave = (message: string) => {
	store.commit('setChannel', null);
	showNotification('leave', message);
};

// Native alerts pause the event loop and can interrupt Socket.IO heartbeats.
notificationSocket.on('error', onChatError);
notificationSocket.on('notify', onChatNotify);
notificationSocket.on('leave', onChatLeave);

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


if (store.getters.channel?.id != null) {
	console.log("channel id: ", store.getters.channel.id);

}

store.getters.socket.on("user-list", (data: any) => {
	console.log("user list: ", data);
	store.commit("setUsers", data)
	chatFriend();
	console.log("set users: " + store.getters.users)
});

store.getters.socket.on("channel-list", (data: any) => {
	store.commit("setChannels", data)
	const selected = store.getters.channel;
	if (!store.getters.isDM && selected?.id) store.getters.socket.emit('all-message', selected.id);
	console.log("set channels: " + store.getters.channels)
});

// Channel membership may be changed by someone connected to another server.
store.getters.socket.on('channel-lists-stale', () => {
	store.getters.socket.emit('channel-list');
	store.getters.socket.emit('all-channel-list');
});

store.getters.socket.on('users-list-stale', () => store.getters.socket.emit('user-list'));
store.getters.socket.on('connect', () => {
	connectionNotice.value = '';
	store.getters.socket.emit('reset');
});
store.getters.socket.on('disconnect', () => {
	connectionNotice.value = '연결이 끊겨 다시 연결하고 있습니다. 작성 중인 메시지는 유지됩니다.';
});
store.getters.socket.on('connect_error', () => {
	connectionNotice.value = '채팅 서버에 연결하지 못했습니다. 연결이 복구되지 않으면 다시 로그인해 주세요.';
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

onMounted(() => {
	store.getters.socket.emit('reset');
	chatFriend();
});

onUnmounted(() => {
	notificationSocket.off('error', onChatError);
	notificationSocket.off('notify', onChatNotify);
	notificationSocket.off('leave', onChatLeave);
	if (store.getters.socket != null){
		store.getters.socket.close();
		store.commit("setSocket", null);
	}
});

</script>

<style scoped>
/* Keep the existing chat handlers; each pane owns its width and scrolling. */
.chat-notifications { max-height: 16rem; overflow-y: auto; }
.chat-notice { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 0.75rem 1rem; background: #334155; color: white; }
.chat-notice-error { background: #7f1d1d; }
.chat-notice p { margin: 0; overflow-wrap: anywhere; }
.chat-notice button { flex-shrink: 0; padding: 0.25rem 0.5rem; border: 1px solid currentColor; border-radius: 0.25rem; }
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
