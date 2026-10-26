<template>
  <TransitionRoot as="template" :show="store.getters.openAdmin">
    <Dialog as="div" class="relative z-10" @close="closeSlider">
      <TransitionChild as="template" enter="ease-in-out duration-500" enter-from="opacity-0" enter-to="opacity-100" leave="ease-in-out duration-500" leave-from="opacity-100" leave-to="opacity-0">
        <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
      </TransitionChild>

      <div class="fixed inset-0 overflow-hidden">
        <div class="absolute inset-0 overflow-hidden">
          <div class="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
            <TransitionChild as="template" enter="transform transition ease-in-out duration-500 sm:duration-700" enter-from="translate-x-full" enter-to="translate-x-0" leave="transform transition ease-in-out duration-500 sm:duration-700" leave-from="translate-x-0" leave-to="translate-x-full">
              <DialogPanel class="pointer-events-auto relative w-screen max-w-md">
                <TransitionChild as="template" enter="ease-in-out duration-500" enter-from="opacity-0" enter-to="opacity-100" leave="ease-in-out duration-500" leave-from="opacity-100" leave-to="opacity-0">
                  <div class="absolute top-0 left-0 -ml-8 flex pt-4 pr-2 sm:-ml-10 sm:pr-4">
                    <button type="button" aria-label="채널 설정 닫기" class="rounded-md text-gray-300 hover:text-white focus:outline-none" @click="closeSlider">
                      <font-awesome-icon icon="fa-solid fa-x" />
                    </button>
                  </div>
                </TransitionChild>
                <div class="flex h-full flex-col overflow-y-scroll bg-gray-800 py-6 shadow-xl">
                  <div class="px-4 sm:px-6">
                    <DialogTitle class="text-lg font-medium text-gray-200"> Channel Settings </DialogTitle>
                  </div>
                  <div class="relative flex-1 px-4 sm:px-6 flex-col">
										<div v-if="channelOwner === store.getters.userid">
											<div class="flex mt-8">
												<div class="text-lg font-medium text-gray-200 mr-4"> Password </div>
												<Switch
													v-model="enabled"
													:disabled="!privacyKnown"
													:class="enabled ? 'bg-violet-900' : 'bg-violet-700'"
													class="switch-outer">
													<span :class="enabled ? 'translate-x-6' : 'translate-x-1'"
													class="switch-inner" />
												</Switch>
												<button type="button" class="accept-button" :disabled="!canSavePassword" @click="changePassword()"> Save </button>
											</div>
											<div class="flex my-6" v-if="enabled">
												<input type="password" class="form-input w-full text-2xl" placeholder="비밀번호를 변경할 때만 입력" autocomplete="new-password" v-model="password" />
											</div>
											<p v-if="!privacyKnown" role="status" class="text-sm text-gray-300">채널 공개 설정을 확인하고 있습니다.</p>

										</div>

										<div class="flex flex-col mt-6">
											<div class="text-lg font-medium text-gray-200 mr-4"> Users </div>
												<div class="user-wrap" v-for="user in users" :key="user">
													<p>{{ user.name }}</p>
													<div class="mr-2">
													<div class="user-button" @click="addAdmin(channelId, user.id)" v-if="!user.isAdmin">admin</div>
													<div class="user-button bg-violet-900" @click="removeAdmin(channelId, user.id)" v-else>admin</div>
													<div class="user-button" @click="muteUser(channelId, user.id)" v-if="!user.isMuted">mute</div>
													<div class="user-button" @click="unmuteUser(channelId, user.id)" v-else>unmute</div>
													<div class="user-button" @click="kickUser(channelId, user.id)">kick</div>
													<div class="user-button" @click="banUser(channelId, user.id)">ban</div>
												</div>
											</div>
										</div>
                  </div>
								</div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
			</div>
    </Dialog>
  </TransitionRoot>
</template>

<script setup lang="ts">
import store from '@/store';
import { computed, ref, watch, onUnmounted } from 'vue';
import { Switch, Dialog, DialogPanel, DialogTitle, TransitionChild, TransitionRoot } from '@headlessui/vue'

function closeSlider() {
	store.commit("setOpenAdmin", false);
}

const socket = store.getters.socket;

function receiveChannelUsers(data: any) {
	if (!store.getters.openAdmin) return;
	const changed = channelId.value !== data.channelId;
	channelId.value = data.channelId;
	channelOwner.value = data.channelOwner;
	users.value = data.channelUsers;
	if (changed) resetPrivacy();
	// channelUserList contains membership only. The existing all-channel-list
	// response is the server's public { id, name, isPrivate } representation.
	if (!privacyKnown.value) socket.emit('all-channel-list');
}

function receiveChannelPrivacy(channels: any) {
	if (!store.getters.openAdmin || channelId.value == null || !Array.isArray(channels)) return;
	const channel = channels.find((value: any) => value.id === channelId.value);
	if (typeof channel?.isPrivate !== 'boolean') {
		resetPrivacy();
		return;
	}
	if (!privacyKnown.value || originalPrivacy.value !== channel.isPrivate) {
		enabled.value = channel.isPrivate;
		password.value = '';
	}
	originalPrivacy.value = channel.isPrivate;
	privacyKnown.value = true;
}

function kickUser(channelId: number, userId: number) {
	store.getters.socket.emit("admin", {
		channel: channelId,
		user: userId,
		type: 'kick'
	});
}

function muteUser(channelId: number, userId: number) {
	console.log("mute user");
	store.getters.socket.emit("admin", {
		channel: channelId,
		user: userId,
		type: 'mute'
	});
}

function unmuteUser(channelId: number, userId: number) {
	console.log("unmute user");
	store.getters.socket.emit("admin", {
		channel: channelId,
		user: userId,
		type: 'unmute'
	});
}

function banUser(channelId: number, userId: number) {
	console.log("ban user");
	store.getters.socket.emit("admin", {
		channel: channelId,
		user: userId,
		type: 'ban'
	});
}

function addAdmin(channelId: number, userId: number) {
	console.log("add admin");
	store.getters.socket.emit("admin", {
		channel: channelId,
		user: userId,
		type: 'add-admin'
	});
}

function removeAdmin(channelId: number, userId: number) {
	console.log("remove admin");
	store.getters.socket.emit("admin", {
		channel: channelId,
		user: userId,
		type: 'remove-admin'
	});
}

function changePassword() {
	if (!canSavePassword.value) return;
	store.getters.socket.emit("admin", {
		channel: channelId.value,
		type: 'change-password',
		isPrivate: enabled.value,
		password: password.value
	});
	password.value = '';
}

const enabled = ref(false);
const password = ref('');
const privacyKnown = ref(false);
const originalPrivacy = ref<boolean | null>(null);
const users = ref([] as any);
const channelId = ref();
const channelOwner = ref();
const canSavePassword = computed(() => privacyKnown.value &&
	(enabled.value !== originalPrivacy.value || password.value.length > 0) &&
	(!enabled.value || password.value.length > 0));

function resetPrivacy() {
	privacyKnown.value = false;
	originalPrivacy.value = null;
	enabled.value = false;
	password.value = '';
}

watch(() => store.getters.openAdmin, () => {
	channelId.value = undefined;
	channelOwner.value = undefined;
	users.value = [];
	resetPrivacy();
}, { immediate: true, flush: 'sync' });

socket.on('channelUserList', receiveChannelUsers);
socket.on('all-channel-list', receiveChannelPrivacy);
onUnmounted(() => {
	socket.off('channelUserList', receiveChannelUsers);
	socket.off('all-channel-list', receiveChannelPrivacy);
	password.value = '';
});

</script>
