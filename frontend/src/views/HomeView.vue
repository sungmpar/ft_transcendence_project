<template>
	<div class = "bg-gray-800 w-full min-h-screen text-gray-100">
		<div class="top-0 right-0 bottom-0 left-20">
			<div class="flex flex-col sm:flex-row sm:items-center rounded-lg bg-gradient-to-r from-purple-400 via-violet-600  to-purple-700 animate-gradient-x px-3 pt-0 pb-2 mb-2">
				<div class="flex flex-row text-3xl mt-2 px-2 pt-4 pb-2 mb-2">
					<p class="drop-shadow-lg font-extrabold text-black-700 ">PING &nbsp;</p>
					<p class="drop-shadow-lg font-extrabold text-black-700">&nbsp;P</p>
					<img src="../assets/pong.png" class="drop-shadow-lg animate-bounce h-8 pt-2">
					<p class="drop-shadow-lg font-extrabold text-black-700">NG</p>
				</div>
				<div class="sm:ml-auto sm:pt-8 px-2">
					<p class="text-gray-400 drop-shadow-lg font-bold">{{ store.getters.usernickname }}</p>
				</div>
				<div class="ml-3 px-1" v-if="store.getters.userid != 0">
					<img :src="get_avatar(store.getters.userid)" class=" object-contain h-20 w-20 pt-2"/>
				</div>
				<div class="flex justify-start sm:justify-center px-2 sm:px-0">
					<button class="gray-button" type="button" @click="logout">
						Logout
					</button>
				</div>
			</div>

			<main class="px-4 sm:px-6 lg:px-8 py-6 space-y-6">
				<section class="rounded-lg bg-gray-900 border border-gray-700 px-5 py-6 sm:px-7">
					<p class="text-sm font-bold text-violet-300 mb-2">Portfolio Demo</p>
					<h1 class="text-2xl sm:text-3xl font-extrabold text-white mb-3">데모 사용 가이드</h1>
					<p class="text-sm sm:text-base leading-7 text-gray-300 max-w-4xl">
						좌측 사이드바에서 채팅, 게임, 관전, 전적 기능을 체험할 수 있습니다. 게스트 계정은 일회용 데모 계정입니다.
					</p>
				</section>

				<section>
					<div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
						<article
							v-for="item in guideItems"
							:key="item.title"
							class="rounded-lg bg-gray-900 border border-gray-700 px-5 py-5"
						>
							<h2 class="text-lg font-extrabold text-white mb-2">{{ item.title }}</h2>
							<p class="text-sm leading-6 text-gray-400">{{ item.description }}</p>
						</article>
					</div>
				</section>

				<section class="rounded-lg bg-violet-900 border border-violet-700 px-5 py-6 sm:px-7">
					<h2 class="text-xl font-extrabold text-white mb-4">게임 체험 방법</h2>
					<ol class="space-y-3">
						<li
							v-for="(step, index) in gameSteps"
							:key="step"
							class="flex gap-3 text-sm leading-6 text-violet-100"
						>
							<span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-500 text-xs font-extrabold text-white">
								{{ index + 1 }}
							</span>
							<span>{{ step }}</span>
						</li>
					</ol>
				</section>

				<section class="rounded-lg bg-gray-900 border border-gray-700 px-5 py-6 sm:px-7">
					<h2 class="text-xl font-extrabold text-white mb-4">포트폴리오 안내</h2>
					<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
						<p
							v-for="note in portfolioNotes"
							:key="note"
							class="rounded-md bg-gray-800 border border-gray-700 px-4 py-4 text-sm leading-6 text-gray-300"
						>
							{{ note }}
						</p>
					</div>
				</section>
			</main>
		</div>
	</div>
	</template>

<script setup lang="ts">

import router from '@/router';
import store from '@/store';
import axios from 'axios';

const backendBaseUrl = process.env.VUE_APP_BACKEND_URL || window.location.origin
const guideItems = [
	{
		title: 'Home',
		description: '현재 화면으로 돌아옵니다.',
	},
	{
		title: 'Chat',
		description: '채널 채팅과 1:1 DM을 체험할 수 있습니다.',
	},
	{
		title: 'Friends',
		description: '친구 목록을 열고 친구 상태를 확인합니다.',
	},
	{
		title: 'Game',
		description: '실시간 Pong 게임에 입장합니다. 두 명의 사용자가 Game에 접속하면 매칭 후 플레이할 수 있습니다.',
	},
	{
		title: 'Invite',
		description: '접속 중인 친구를 게임에 초대할 수 있습니다.',
	},
	{
		title: 'Spectate',
		description: '진행 중인 게임이 있으면 관전할 수 있습니다.',
	},
	{
		title: 'Info',
		description: '닉네임과 프로필 정보를 확인하거나 수정합니다.',
	},
	{
		title: 'Leader Board',
		description: '경기 기록, 승패, 랭킹 정보를 확인합니다.',
	},
	{
		title: '2FA',
		description: '이메일 2단계 인증 설정을 확인할 수 있습니다. 데모 환경에서는 이메일 설정에 따라 제한될 수 있습니다.',
	},
]
const gameSteps = [
	'브라우저 두 개 또는 시크릿 창을 이용해 게스트 계정 2개로 로그인합니다.',
	'두 계정 모두 좌측 Game 아이콘으로 입장합니다.',
	'매칭이 되면 실시간 Pong 게임을 플레이할 수 있습니다.',
	'한 계정은 Spectate 메뉴에서 진행 중인 게임을 관전할 수 있습니다.',
]
const portfolioNotes = [
	'이 프로젝트는 42서울 ft_transcendence 과제를 기반으로 합니다.',
	'공개 데모를 위해 Guest Login과 HTTPS 배포를 추가했습니다.',
	'백엔드는 TypeScript/NestJS, PostgreSQL, Socket.IO 기반으로 동작합니다.',
]

async function logout() {
	await axios.get('/auth/logout')
	.then((response) => {
		console.log(response);
	})
	.catch((error) => {
		console.log(error);
	});
	localStorage.removeItem("token");
	router.push("/login");
}

function get_avatar(str :string) {
	return (`${backendBaseUrl}/user/image/`+ str);
}

</script>
