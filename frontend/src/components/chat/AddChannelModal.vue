<template>
  <TransitionRoot appear :show="store.getters.isAdding" as="template">
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
              <DialogTitle as="h3" class="text-lg font-medium leading-6 text-white">New Channel</DialogTitle>
              <div class="mt-6">
								<label for="title" class="block text-md font-medium text-gray-200">Title</label>
								<div class="mt-2 relative rounded-md shadow-sm">
									<input type="text" name="title" id="title" class="w-full pl-2 pr-12 border-gray-500 rounded-md" placeholder="42seoul_random"  v-model="name">
								</div>
              </div>
							<div class="flex mt-8 items-center">
							<div class="block text-md font-medium text-gray-200 mr-2"> Password </div>
							<Switch
								v-model="enabled"
								:class="enabled ? 'bg-violet-900' : 'bg-violet-700'"
								class="switch-outer">
								<span :class="enabled ? 'translate-x-6' : 'translate-x-1'"
								class="switch-inner" />
							</Switch>
							</div>
							<div class="flex mt-4 mb-8" v-if="enabled">
								<input type="password" class="form-input w-full text-2xl" v-model="password" />
							</div>
              <div class="mt-6 mb-4 flex justify-center items-center">
							<button type="button" class="deny-button" @click="closeModal">Back</button>
							<button type="button" class="accept-button" @click="createChannel">Create</button>
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
import { Switch, TransitionRoot, TransitionChild, Dialog, DialogPanel, DialogTitle, } from '@headlessui/vue'

function closeModal() {
	store.commit('setIsAdding', false)
	console.log("adding? "+ store.getters.isAdding)
}

async function createChannel() {
	await store.getters.socket.emit('create', {
			name: name.value,
			password: password.value,
			isPrivate: enabled.value,
	});
	closeModal()
}

const enabled = ref(false)
const name = ref('')
const password = ref('')

</script>
