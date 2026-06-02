<template>
	<SpectateSlider />
	<div class= "game_container  bg-gray-700">
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
			<button type="button" class = "wide-user-button" @click="findRoomList">find</button>
			<button type="button" class = "wide-user-button" @click="spectateGame">view</button>
		</div>
	</div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { GameplayService } from '@/plugins/gamePlayService';
import store from '@/store';
import { GameState } from '@/interfaces/Game';
import { SpectatorStartText, StartText } from '@/plugins/text';
import { GameImageService } from '@/models/GameImageService';
import SpectateSlider from "../components/game/SpectateSlider.vue";
import axios from 'axios';

store.getters.gameSocket.on("update", (data: GameState) => {
	store.commit("setGameData", data);
});

store.getters.gameSocket.on("end", (data: string) => {
	store.getters.gameSocket.emit("achievement");
	GameplayService.stop(data);
});

store.getters.gameSocket.on("setData", (data: any) => {
	store.commit("setRoomData", data);
});

store.getters.gameSocket.on("finish", (data: any) => {
	store.commit("setRoomData", data);
	GameplayService.stopSpectate(data);
});

store.getters.gameSocket.on("roomlist", (data: any) => {
	console.log("data : ", data);
	store.commit("setRoomList", data);
});

function initGame(){
	var canvas = document.getElementById('gameCanvas') as HTMLCanvasElement | null;
	if (canvas?.getContext){
		let context = canvas.getContext('2d')!;
		canvas.width = canvas.offsetWidth;
		canvas.height = canvas.offsetHeight;
		SpectatorStartText.draw(context, canvas.width/4, canvas.height/2);
	}
}

function findRoomList(){
	store.getters.gameSocket.emit('roomlist');
	store.commit('setIsSearching', true);
}

function startGame(){
	var canvas = document.getElementById('gameCanvas') as HTMLCanvasElement | null;
	if (canvas?.getContext){
		let context = canvas.getContext('2d')!;
		canvas.width = canvas.offsetWidth;
		canvas.height = canvas.offsetHeight;
		GameplayService.start(context, "black");
	}
}

async function spectateGame() {
	if (store.getters.room.roomId === "") {
		alert("관전할 방을 선택해주세요");
		return;
	}
	startGame();
	await store.getters.gameSocket.emit("spectate", {id: store.getters.room.roomId});
}

onMounted(() => {
	setTimeout(async () => {
		await GameImageService.loadImages();
	}),
	initGame();
});

onUnmounted(() => {
	store.getters.gameSocket.emit("end");
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
	if (store.getters.gameSocket != null){
		store.getters.gameSocket.close();
		store.commit("setGameSocket", null);
	}
});

</script>
