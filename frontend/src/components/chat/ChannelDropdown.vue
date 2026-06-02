<template>
<div class='dropdown'>
	<div class="dropdown-header">
		<div @click="setExpanded(!expanded)">
			<div class="flex" v-show="expanded">
				<font-awesome-icon icon="fa-chevron-down" class="dropdown-header-text-selected channel-icon" />
				<h5 class="dropdown-header-text-selected">Channels</h5>
			</div>
			<div class="flex" v-show="!expanded">
				<font-awesome-icon icon="fa-chevron-right" class="flex dropdown-header-text channel-icon" />
				<h5 class="dropdown-header-text">Channels</h5>
			</div>
		</div>
			<div class="flex flex-auto items-center justify-end">
			<font-awesome-icon icon="fa-search" class="channel-icon dropdown-header-text" @click="openSearchSlider"/>
			<font-awesome-icon icon="fa-plus" class="channel-icon dropdown-header-text" @click="openModal"/>
			</div>
	</div>
	<div class="flex flex-col dropdown-selection" v-show="expanded">
	<div v-for="selection in store.getters.channels" :key="selection">
		<div class="flex items-center" v-if="selection">
			<div class="dropdown-selection-text" @click="setChannel(selection)"># {{ selection.name }}</div>
			<font-awesome-icon icon="fa-sign-out" class="mr-1 dropdown-selection-text" @click="leaveChannel(selection.id)"/>
			<font-awesome-icon icon="fa-gear" class="mr-2 dropdown-selection-text" v-show="isAdmin(selection.owner, selection.admins)" @click="openAdminSlider(selection.id)"/>
		</div>
	</div>
	</div>
</div>
</template>

<script setup lang="ts">
import store from "@/store";
import { ref } from "vue";
import { onUnmounted } from "vue";

const expanded = ref(false);

store.getters.socket.on("leave", (data: any) => {
	alert(data);
	store.commit("setChannel", null);
});

store.getters.socket.on("all-message", (data: any) => {
	console.log("all message: ", data);
	store.commit("loadChannelMessage", data);
});

function setExpanded(isExpanded: boolean) {
	expanded.value = isExpanded;
	console.log("expanded: " + expanded.value);
}

function setChannel(channel: any) {
	// console.log(channel);
	store.commit("setChannel", channel);
	store.getters.socket.emit("all-message", channel.id);
	store.commit("setIsDM", false);
}

function openModal() {
	console.log("open modal");
	store.commit('setIsAdding', true);
	console.log("opened : " + store.getters.isAdding);
}

function openSearchSlider() {
	console.log("open slider");
	store.commit('setIsSearching', true);
	console.log("opened : " + store.getters.isSearching);
}

function leaveChannel(channelId: number) {
	store.getters.socket.emit("leave", channelId);
}

function openAdminSlider(channelId: number) {
	store.commit('setOpenAdmin', true);
	store.getters.socket.emit("channelUserList", channelId);
}

function isAdmin(ownerId: number, admins: any) {
	return (ownerId === store.getters.userid || admins.includes(store.getters.userid));
}

</script>
