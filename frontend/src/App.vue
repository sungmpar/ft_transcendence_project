<template>
<div class="flex ...">
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

</script>
