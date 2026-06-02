<template>
	<div class= "game_container  bg-gray-700">
		<div id = "full-screen">
		</div>
	</div>
</template>

<script setup lang="ts">

import { onMounted } from 'vue'
import { useRoute } from 'vue-router';
import { watch } from 'vue';
import router from '@/router';

const route = useRoute();
watch(() => route, () => {
	console.log("route");
}, {
  deep: true
})


onMounted(() => {
	router.replace({ name: "chat", force: true});
});
</script>
