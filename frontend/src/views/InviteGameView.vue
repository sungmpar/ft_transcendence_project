<template>
	<InviteSlider />
	<div class= "game_container bg-gray-700">
		<div id = "full-screen">
			<div class = "flex flex-row items-center justify-center w-[1200px]">
				<div class = "flex flex-row items-center justify-center w-[350px]">
					<span class = "text-3xl mx-20 my-8 text-purple-200"> {{store.getters.room.leftName}} </span>
				</div>
				<div class = "flex flex-row items-center justify-center w-[150px]">
					<span class = "text-4xl mx-20 my-8 text-purple-200"> {{store.getters.gameData.score.left}} </span>
				</div>
				<div class = "flex flex-row items-center justify-center w-[200px]">
					<span class = "text-4xl mx-20 my-8 text-purple-400 "> vs </span>
				</div>
				<div class = "flex flex-row items-center justify-center w-[150px]">
					<span class = "text-4xl mx-20 my-8 text-purple-200"> {{store.getters.gameData.score.right}} </span>
				</div>
				<div class = "flex flex-row items-center justify-center w-[350px]">
					<span class = "text-3xl mx-20 my-8 text-purple-200"> {{store.getters.room.rightName}} </span>
				</div>
			</div>
				<canvas id = "gameCanvas" class="canvas"></canvas>
				<div class = "flex flex-row">
					<button type="button" class = "balance-user-button" @click="findInviteList"> invite list </button>
					<div v-if="store.getters.inviteFriendName">
						<button type="button" class = "balance-user-button" @click="modeChange"> mode </button>
					</div>
				</div>
				<div class = "flex flex-row">
					<button type="button" class = "user-play-button mb-10" @click="changeMapA">◁</button>
					<div v-if="store.getters.inviteFriendName">
						<button type="button" class = "user-play-button mb-10" @click="inviteGame">invite</button>
					</div>
					<button type="button" class = "user-play-button mb-10" @click="changeMapB">▷</button>
				</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, watch, onUpdated } from 'vue'
import { GameImageService } from '@/models/GameImageService';
import { GameplayService } from '@/plugins/gamePlayService';
import store from '@/store';
import { GameState } from '@/interfaces/Game';
import { StartText } from '@/plugins/text';
import { useRoute } from 'vue-router';
import InviteSlider from "../components/game/InviteSlider.vue";
import axios from 'axios';

let backgroundImage = "black";
let ready = false;
let map: string[] = ["winter", "black", "space"];
let count = 1;
let mode = true;
let mapChange = true;

const route = useRoute();
watch(() => route, () => {
	console.log("route");
}, {
  deep: true
})

function changeMapA(){
	if (!ready){
		if (count != 0){
			count -= 1;
		}
		backgroundImage = map[count];
		initGame(backgroundImage, ready);
	}
}

function changeMapB(){
	if (!ready){
		if (count < 2){
			count += 1;
		}
		backgroundImage = map[count];
		initGame(backgroundImage, ready);
	}
}

function modeChange(){
	if (!ready){
		if (mode)
			mode = false;
		else
			mode = true;
		store.commit("setMode", mode);
		initGame(backgroundImage, ready);
	}
}

store.getters.gameSocket.on("refuse", (data: any) => {
	alert(`초대를 거절했습니다.`);
});


store.getters.gameSocket.on("ready", (data: any) => {
	store.commit("setRoom", data);
	startGame();
});

store.getters.gameSocket.on("update", (data: GameState) => {
	store.commit("setGameData", data);
});

store.getters.gameSocket.on("end", (data: string) => {
	ready = false;
	store.getters.gameSocket.emit("achievement");
	if ((data == "left" && store.getters.room.leftName == store.getters.usernickname) ||
			(data == "right" && store.getters.room.rightName == store.getters.usernickname)){
		alert("게임에서 승리하였습니다")
	}
	else {
		alert("게임에서 패배하였습니다")
	}
	GameplayService.stop(data);
});

store.getters.gameSocket.on("invite", (data: string) => {
	alert("초대 메세지를 발송했습니다.");
});

store.getters.gameSocket.on("userInviteList", (data: any) => {
	store.commit("setUserInviteList", data);
});

store.getters.gameSocket.on("error", (data: any) => {
	alert(data.message);
});

function findInviteList(){
	store.getters.gameSocket.emit('invitelist');
	store.commit('setIsSearching', false);
}

function initGame(text: string, ready: boolean){
	store.commit("setGameData",
	{
		ball: {x: 0, y: 0},
		leftBar: {x: 0, y: 0, power: false},
		rightBar: {x: 0, y: 0, power: false},
		score: {left: 0, right: 0},
	});
	store.commit("setRoom",
	{
		id: "",
		leftName: "",
		rightName: "",
	});
	var canvas = document.getElementById('gameCanvas') as HTMLCanvasElement | null;
	if (canvas?.getContext){
		let context = canvas.getContext('2d')!;
		canvas.width = canvas.offsetWidth;
		canvas.height = canvas.offsetHeight;
		StartText.draw(context, canvas.width/2, canvas.height/6, text, ready);
	}
}

function startGame(){
	var canvas = document.getElementById('gameCanvas') as HTMLCanvasElement | null;
	if (canvas?.getContext){
		let context = canvas.getContext('2d')!;
		canvas.width = canvas.offsetWidth;
		canvas.height = canvas.offsetHeight;
		GameplayService.start(context, backgroundImage);
	}
}

async function inviteGame() {
	if (!ready){
		ready = true;
		initGame(backgroundImage, ready);
		console.log(route.params.friendId);
		console.log(store.getters.inviteFriendId);
		await store.getters.gameSocket.emit("invite", {
			id: store.getters.userId,
			friendId: store.getters.inviteFriendId,
			mode: mode,
		});
	}
}

onMounted(() => {
	store.commit("setInviteFriendId", route.params.friendId);
	store.commit("setInviteFriendName", route.params.friendName);
	if (store.getters.inviteFriendName)
		store.commit('setIsSearching', true);
	else {
		store.getters.gameSocket.emit('invitelist');
		store.commit('setIsSearching', false);
	}
	setTimeout(async () => {
		await GameImageService.loadImages();
	}),
	initGame("black", ready);
});

onUnmounted(() => {
	console.log("invite view unmounted 되었습니다.");
	store.getters.gameSocket.emit("end");
	store.commit('setIsSearching', false);
	store.commit("setGameData",
	{
		ball: {x: 0, y: 0},
		leftBar: {x: 0, y: 0, power: false},
		rightBar: {x: 0, y: 0, power: false},
		score: {left: 0, right: 0},
	});
	store.commit("setRoom",
	{
		id: "",
		leftName: "",
		rightName: "",
	});
	store.commit("setInviteFriendId", "");
	store.commit("setInviteFriendName", "");
	if (store.getters.gameSocket != null){
		store.getters.gameSocket.close();
		store.commit("setGameSocket", null);
	}
});

</script>
