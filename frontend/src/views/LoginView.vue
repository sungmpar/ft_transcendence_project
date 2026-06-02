<template>
  <div class="bg-gray-800 flex z-[1000] justify-center absolute top-0 right-0 bottom-0 left-0">
    <div class="flex-center flex flex-col gap-4">
      <button class="normal-button" @click="signin42">
          42 로그인
      </button>
      <button v-if="isGuestLoginEnabled" class="normal-button" @click="signinGuest">
          게스트로 체험하기
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">

const isGuestLoginEnabled = process.env.VUE_APP_ENABLE_GUEST_LOGIN === 'true'

async function signin42(){
	var url = `http://${process.env.VUE_APP_SERVER_IP}:${process.env.VUE_APP_BACKEND_PORT}/auth/42`
	document.location = url
}

async function signinGuest(){
	var url = `http://${process.env.VUE_APP_SERVER_IP}:${process.env.VUE_APP_BACKEND_PORT}/auth/guest`
	document.location = url
}

</script>
