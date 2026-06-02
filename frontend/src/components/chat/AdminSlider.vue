<template>
  <TransitionRoot as="template" :show="store.getters.openAdmin">
    <Dialog as="div" class="relative z-10" @close="!store.getters.openAdmin">
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
                    <button type="button" class="rounded-md text-gray-300 hover:text-white focus:outline-none" @click="closeSlider">
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
													:class="enabled ? 'bg-violet-900' : 'bg-violet-700'"
													class="switch-outer">
													<span :class="enabled ? 'translate-x-6' : 'translate-x-1'"
													class="switch-inner" />
												</Switch>
												<button type="button" class="accept-button" @click="changePassword()"> Save </button>
											</div>
											<div class="flex my-6" v-if="enabled">
												<input type="password" class="form-input w-full text-2xl" v-model="password" />
											</div>

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
import { ref, onUnmounted } from 'vue';
import { Switch, Dialog, DialogPanel, DialogTitle, TransitionChild, TransitionRoot } from '@headlessui/vue'

function closeSlider() {
	store.commit("setOpenAdmin", false);
	console.log("open admin: " + store.getters.openAdmin);
}

store.getters.socket.on("channelUserList", (data: any) => {
	channelId.value = data.channelId;
	channelOwner.value = data.channelOwner;
	users.value = data.channelUsers;
});

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
	console.log("change password");
	store.getters.socket.emit("admin", {
		channel: channelId.value,
		type: 'change-password',
		isPrivate: enabled.value,
		password: password.value
	});
}

const enabled = ref(false);
const password = ref('');
const users = ref([] as any);
const channelId = ref();
const channelOwner = ref();

</script>
