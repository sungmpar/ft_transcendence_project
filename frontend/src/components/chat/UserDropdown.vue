<template>
<div class='dropdown'>
	<div class="dropdown-header">
		<div @click="setExpanded(!expanded)">
			<div class="flex" v-show="expanded">
				<font-awesome-icon icon="fa-chevron-down" class="dropdown-header-text-selected channel-icon" />
				<h5 class="dropdown-header-text-selected">Users</h5>
			</div>
			<div class="flex" v-show="!expanded">
				<font-awesome-icon icon="fa-chevron-right" class="flex dropdown-header-text channel-icon" />
				<h5 class="dropdown-header-text">Users</h5>
			</div>
		</div>
	</div>
	<div class="flex flex-col dropdown-selection" v-show="expanded">
		<div v-for="selection in store.getters.users" :key="selection.id">
			<ul>
			<li class="dropdown-selection-text" @click="setChannel(selection)">{{ selection.name }}</li>
			</ul>
		</div>
	</div>
</div>
</template>

<script setup lang="ts">
import store from "@/store";
import { ref, onUnmounted } from "vue";

const expanded = ref(false);

store.getters.socket.on("all-direct-message", (data: any) => {
	store.commit("loadDirectMessage", data);
});

function setExpanded(isExpanded: boolean) {
	expanded.value = isExpanded;
}

function setChannel(channel: any) {
	console.log("selected channel: ", channel)
	store.commit("setChannel", channel);
	store.getters.socket.emit("join-dm", {
		userId: store.getters.userid,
		otherUserId: channel.id,
	});
	store.getters.socket.emit("all-direct-message", {
		userId: store.getters.userid,
		otherUserId: channel.id,
	});
	store.commit("setIsDM", true);
}

</script>

