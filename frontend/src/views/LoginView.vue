<template>
  <div class="bg-gray-800 flex z-[1000] justify-center absolute top-0 right-0 bottom-0 left-0">
    <div class="flex-center">
      <button class="normal-button" @click="signin">
          로그인
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">

async function signin(){
	var url = `http://${process.env.VUE_APP_SERVER_IP}:${process.env.VUE_APP_BACKEND_PORT}/auth/42`
	document.location = url
}


</script>
