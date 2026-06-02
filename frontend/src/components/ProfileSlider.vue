<template>
  <TransitionRoot as="template" :show="store.getters.openProfile">
    <Dialog as="div" class="relative z-10" @close="closeModal">
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
                    <button type="button" class="rounded-md text-gray-300 hover:text-white focus:outline-none" @click="closeModal">
                      <font-awesome-icon icon="fa-solid fa-x" />
                    </button>
                  </div>
                </TransitionChild>
                <div class="flex h-full flex-col overflow-y-scroll bg-gray-800 py-6 shadow-xl">
                  <div class="px-4 sm:px-6">
                    <DialogTitle class="text-lg font-medium text-gray-200"> Profile </DialogTitle>
                  </div>
                  <div class="relative mt-6 flex-1 px-4 sm:px-6 flex-col">
										<div class="flex flex-col items-center mt-4">
											<img  :src="get_avatar(store.getters.profileUser.id)" alt='' class="profile-avatar"/>
										</div>
										<div class="flex flex-col mt-8">
											<div class="text-lg font-medium text-gray-200"> {{ store.getters.profileUser.nickname }} </div>
											<div class="text-sm font-medium text-gray-500"> {{ store.getters.profileUser.status }} </div>
										</div>
										<div class="flex flex-col items-center mt-4">
											<button class="profile-button w-full" @click="goPong(store.getters.profileUser.id, store.getters.profileUser.nickname)">play game</button>
											<button class="profile-button w-full" @click="addFriends">add to friends</button>
											<button class="profile-button w-full" @click="addBlocks">block</button>
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
import router from '@/router';
import store from '@/store';
import { Dialog, DialogPanel, DialogTitle, TransitionChild, TransitionRoot } from '@headlessui/vue'
import axios from 'axios';

function closeModal() {
	store.commit("setOpenProfile", false);
	console.log("open profile: " + store.getters.openProfile);
}

async function goPong(userId: number, userName: string) {
	closeModal();
	if (userId == store.getters.userid) {
		alert("자기 자신은 초대할 수 없습니다.");
		return;
	}
	router.push({ name: "tempinvitepage", params: { friendId: userId, friendName: userName }, force: true});
}

function addBlocks() {
	store.getters.socket.emit("blocks", store.getters.profileUser.id);
	// axios.patch("/user/blocks", {
	// 	id: store.getters.profileUser.id
	// }).then((response) => {
	// 	alert("해당 유저를 block했습니다.");
	// 	store.getters.socket.emit('reset');
	// }).catch((error) => {
	// 	if (error.response.status === 409) {
	// 		alert("이미 block되었습니다.");
	// 	} else if (error.response.status === 403) {
	// 		alert("자신은 block할 수 없습니다.");
	// 	}
	// });
}

function addFriends() {
	axios.patch("/user/friends", {
		id: store.getters.profileUser.id
	}).then((response) => {
			alert("해당 유저를 친구로 추가했습니다.");
	}).catch((error) => {
		console.log(error);
		if (error.response.status === 409) {
			alert("이미 친구입니다.");
		} else if (error.response.status === 403) {
			alert("자신은 친구로 추가할 수 없습니다.");
		}
	});
}

function get_avatar(id: number) {
	return (`http://${process.env.VUE_APP_SERVER_IP}:${process.env.VUE_APP_BACKEND_PORT}/user/image/${id}`);
}

</script>
