<template>
  <TransitionRoot appear :show="store.getters.isJoining" as="template">
    <Dialog as="div" @close="closeModal" class="relative z-10">
      <TransitionChild
        as="template"
        enter="duration-300 ease-out"
        enter-from="opacity-0"
        enter-to="opacity-100"
        leave="duration-200 ease-in"
        leave-from="opacity-100"
        leave-to="opacity-0"
      >
      <div class="fixed inset-0 bg-black bg-opacity-25" />
      </TransitionChild>

      <div class="fixed inset-0 overflow-y-auto">
        <div
          class="flex min-h-full items-center justify-center p-4 text-center"
        >
          <TransitionChild
            as="template"
            enter="duration-300 ease-out"
            enter-from="opacity-0 scale-95"
            enter-to="opacity-100 scale-100"
            leave="duration-200 ease-in"
            leave-from="opacity-100 scale-100"
            leave-to="opacity-0 scale-95"
          >
            <DialogPanel
              class="w-full max-w-md transform overflow-hidden rounded-2xl bg-gray-700 p-6 text-left align-middle shadow-xl transition-all">
              <DialogTitle as="h3" class="text-lg font-medium leading-6 text-white">{{ store.getters.joinChannel.name }}</DialogTitle>
							<div class="flex mt-8 items-center" v-if="store.getters.joinChannel.isPrivate">
							<div class="block text-md font-medium text-gray-200 mr-4"> Password </div>
							<input type="password" class="form-input w-full text-2xl" v-model="password" />
							</div>
              <div class="mt-8 mb-4 flex justify-center items-center">
							<button type="button" class="deny-button" @click="closeModal">Back</button>
							<button type="button" class="accept-button" @click="joinChannel">Join</button>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>

<script setup lang="ts">
import store from "@/store"
import { ref } from 'vue'
import { TransitionRoot, TransitionChild, Dialog, DialogPanel, DialogTitle, } from '@headlessui/vue'

function closeModal() {
	store.commit('setIsJoining', false)
	console.log("join? "+ store.getters.isJoining)
}

async function joinChannel() {
	console.log("join channel " + store.getters.joinChannel.name + " " + password.value);
	await store.getters.socket.emit('join', {
			id: store.getters.joinChannel.id,
			isPrivate: store.getters.joinChannel.isPrivate,
			password: password.value,
		});
	closeModal();
}
const password = ref('')

</script>
