<template>
	<div class= "game_container  bg-gray-700">
		<div class="game-scale-shell">
			<div
				class="game-scale-placeholder"
				:style="{ width: `${GAME_VIEW_WIDTH * gameScale}px`, height: `${GAME_VIEW_HEIGHT * gameScale}px` }"
			>
				<div class="game-scale-wrapper" :style="{ transform: `scale(${gameScale})` }">
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
						<button type="button" class = "wide-user-button" @click="modeChange"> mode </button>
						<div class = "flex flex-row">
							<button type="button" class = "user-play-button mb-10" @click="changeMapA">◁</button>
							<button type="button" class = "user-play-button mb-10" @click="joinToGame">play</button>
							<button type="button" class = "user-play-button mb-10" @click="changeMapB">▷</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { GameImageService } from '@/models/GameImageService';
import { GameplayService } from '@/plugins/gamePlayService';
import store from '@/store';
import { GameState } from '@/interfaces/Game';
import { StartText } from '@/plugins/text';
import axios from 'axios';

let backgroundImage = "black";
let ready = false;
let map: string[] = ["winter", "black", "space"];
let count = 1;
let mode = true;
let mapChange = true;
const gameScale = ref(1);
const GAME_VIEW_WIDTH = 1400;
const GAME_VIEW_HEIGHT = 1000;
const SIDEBAR_WIDTH = 80;

function updateGameScale() {
	const availableWidth = Math.max(window.innerWidth - SIDEBAR_WIDTH, 0);
	const availableHeight = window.innerHeight;
	gameScale.value = Math.min(
		availableWidth / GAME_VIEW_WIDTH,
		availableHeight / GAME_VIEW_HEIGHT,
		1,
	);
}

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

store.getters.gameSocket.on("ready", (data: any) => {
	store.commit("setRoom", data);
	console.log("set Gameroom: " + store.getters.room);
	startGame();
});

store.getters.gameSocket.on("update", (data: GameState) => {
	store.commit("setGameData", data);
});

store.getters.gameSocket.on("end", (data: string) => {
	ready = false;
	store.getters.gameSocket.emit("achievement");
	GameplayService.stop(data);
	if ((data == "left" && store.getters.room.leftName == store.getters.usernickname) ||
			(data == "right" && store.getters.room.rightName == store.getters.usernickname)){
		alert("게임에서 승리하였습니다")
	}
	else {
		alert("게임에서 패배하였습니다")
	}
});

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

async function joinToGame() {
	if (!ready){
		ready = true;
		initGame(backgroundImage, ready);
		await store.getters.gameSocket.emit("matchmaking", {
			userId: store.getters.userid, mode: mode
		});
	}
}

function setStatus(status: string) {
	axios.patch("/user/status", {
			value: status
	});
}

onMounted(() => {
	// console.log("Game view mounted 되었습니다.");
	// setStatus("ingame");
	updateGameScale();
	window.addEventListener('resize', updateGameScale);
	setTimeout(async () => {
		await GameImageService.loadImages();
	}),
	initGame("black", ready);
});

onUnmounted(() => {
	// console.log("Game view unmounted 되었습니다.");
	window.removeEventListener('resize', updateGameScale);
	if (store.getters.gameSocket != null)
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
