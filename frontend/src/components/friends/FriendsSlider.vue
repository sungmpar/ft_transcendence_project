<template>
  <TransitionRoot as="template" :show="store.getters.openFriends">
    <Dialog as="div" class="relative z-10" @close="closeSlider">
      <TransitionChild as="template" enter="ease-in-out duration-500" enter-from="opacity-0" enter-to="opacity-100" leave="ease-in-out duration-500" leave-from="opacity-100" leave-to="opacity-0">
        <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
      </TransitionChild>
      <div class="fixed inset-0 overflow-hidden">
        <div class="absolute inset-0 overflow-hidden">
          <div class="pointer-events-none fixed inset-y-0 left-0 flex max-w-full pl-20">
            <TransitionChild as="template" enter="transform transition ease-in-out duration-500 sm:duration-700" enter-from="-translate-x-full" enter-to="translate-x-0" leave="transform transition ease-in-out duration-500 sm:duration-700" leave-from="translate-x-0" leave-to="-translate-x-full">
              <DialogPanel class="pointer-events-auto relative w-screen max-w-md">
                <TransitionChild as="template" enter="ease-in-out duration-500" enter-from="opacity-0" enter-to="opacity-100" leave="ease-in-out duration-100" leave-from="opacity-100" leave-to="opacity-0">
                  <div class="absolute top-0 right-0 -ml-8 flex pt-4 pr-2 sm:-ml-10 sm:pr-4">
                    <button type="button" class="rounded-md text-gray-300 hover:text-white focus:outline-none" @click="closeSlider">
                      <font-awesome-icon icon="fa-solid fa-x" />
                    </button>
                  </div>
                </TransitionChild>
                <div class="flex h-full flex-col overflow-y-scroll bg-gray-800 py-6 shadow-xl">
                  <div class="px-6">
                    <DialogTitle class="text-lg font-medium text-gray-200"> Friends </DialogTitle>
                  </div>
                  <div class="relative mt-6 flex-1 flex-col">
										<div className='channel-container'>
										<div class="user-wrap" v-for="friend in store.getters.friends" :key="friend">
											<img :src="get_avatar(friend.id)" alt='' class='w-6 mr-3'/>
											<p>{{ friend.nickname }}</p>
											<div class="text-gray-500 ml-6 mr-10">{{ friend.status }}</div>
											<div class="user-button" @click="goChat(friend.id)">chat</div>
											<div class="user-button" @click="goPong(friend.id, friend.nickname)">pong</div>
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
import router from '@/router';
import store from '@/store';
import { Dialog, DialogPanel, DialogTitle, TransitionChild, TransitionRoot } from '@headlessui/vue'

const backendBaseUrl = process.env.VUE_APP_BACKEND_URL || window.location.origin

function closeSlider() {
	store.commit('setOpenFriends', false);
	console.log('closeSlider' + store.getters.openFriends);
}

function goChat(friendId: number) {
	store.commit('setOpenFriends', false);
	console.log('goChat', friendId);
	router.push({ name: 'chat', params: { friendId: friendId }, force: true });
}

async function goPong(friendId: number, friendName: number) {
	store.commit('setOpenFriends', false);
	router.push({ name: "tempinvitepage", params: { friendId: friendId, friendName: friendName }, force: true});
}

function get_avatar(id: number) {
	return (`${backendBaseUrl}/user/image/${id}`);
}

</script>
