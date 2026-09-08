<template>
<router-view v-if="route.meta.publicArcade" :key="route.fullPath" />
<div v-else class="flex ...">
	<div class="w-20">
		<side-bar/>
	</div>
	<div class="flex-auto">
		<router-view/>
	</div>
	<div>
		<friends-slider/>
	</div>
</div>
</template>

<script setup lang="ts">
import SideBar from "@/components/SideBar.vue";
import FriendsSlider from "@/components/friends/FriendsSlider.vue";
import { useRoute } from 'vue-router';

const route = useRoute();

</script>
