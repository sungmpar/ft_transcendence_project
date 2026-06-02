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
                    <DialogTitle class="text-lg font-medium text-gray-200"> Game List </DialogTitle>
                  </div>
                  <div class="relative mt-6 flex-1 px-4 sm:px-6 flex-col">
									<div v-for="room in store.getters.roomList" v-bind:key="room">
										<div class="roomlist-element" @click="insertRoomData(room)">
											<p>{{ room.leftName }} vs {{ room.rightName}}</p>
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

function closeSlider() {
	store.commit('setIsSearching', false)
}

function insertRoomData(room: any) {
	console.log("room id :", room.roomId)
	console.log("room left :", room.leftName)
	console.log("room right :", room.rightName)
	store.commit('setRoom', room);
	closeSlider();
}

</script>
