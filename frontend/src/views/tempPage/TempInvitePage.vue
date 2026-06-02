<template>
	<div class= "game_container  bg-gray-700">
		<div id = "full-screen">
		</div>
	</div>
</template>

<script setup lang="ts">

import router from '@/router';
import { onMounted } from 'vue'
import { useRoute } from 'vue-router';
import { watch } from 'vue';

const route = useRoute();
watch(() => route, () => {
	console.log("route");
}, {
  deep: true
})


onMounted(() => {
	router.replace({ name: "invite", params: { friendId: route.params.friendId, friendName: route.params.friendName }, force: true});
});

</script>
