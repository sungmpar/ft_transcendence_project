<template>
  <TransitionRoot as="template" :show="store.getters.isSearching">
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
                    <button type="button" class="rounded-md text-gray-300 hover:text-white focus:outline-none" @click="closeSlider">
                      <font-awesome-icon icon="fa-solid fa-x" />
                    </button>
                  </div>
                </TransitionChild>
                <div class="flex h-full flex-col overflow-y-scroll bg-gray-800 py-6 shadow-xl">
                  <div class="px-4 sm:px-6">
                    <DialogTitle class="text-lg font-medium text-gray-200"> Channels </DialogTitle>
                  </div>
                  <div class="relative mt-6 flex-1 px-4 sm:px-6 flex-col">
									<div v-for="channel in store.getters.allChannels" v-bind:key="channel">
										<div class="channel-element" @click="openModal(channel)">
											<p>{{ channel.name }}</p>
											<font-awesome-icon icon="fa-key" class="flex" v-if="channel.isPrivate"></font-awesome-icon>
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
import store from "@/store"
import { Dialog, DialogPanel, DialogTitle,TransitionChild, TransitionRoot } from '@headlessui/vue'

store.getters.socket.emit("all-channel-list");

function closeSlider() {
	store.commit('setIsSearching', false)
	console.log("searching? "+ store.getters.isSearching)
}

function openModal(channel: any) {
	console.log("open modal");
	store.commit('setJoinChannel', channel);
	console.log("join channel: "+ store.getters.joinChannel);
	store.commit('setIsJoining', true);
	console.log("opened : " + store.getters.isJoining);
}

store.getters.socket.on("all-channel-list", (data: any) => {
	store.commit("setAllChannels", data);
});

</script>
