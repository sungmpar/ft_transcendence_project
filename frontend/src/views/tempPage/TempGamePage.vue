<template>
	<div class= "game_container  bg-gray-700">
		<div id = "full-screen">
		</div>
	</div>
</template>

<script setup lang="ts">

import router from '@/router';
import { onMounted, watch } from 'vue'
import { useRoute } from 'vue-router';

const route = useRoute();
watch(() => route, () => {
	console.log("route");
}, {
  deep: true
})

onMounted(() => {
	router.replace({ name: "game", force: true});
});

</script>
