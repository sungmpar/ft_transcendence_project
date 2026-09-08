<template>
  <div class="bg-gray-900 text-gray-100 flex z-[1000] justify-center items-center absolute top-0 right-0 bottom-0 left-0 overflow-y-auto px-4 py-8">
    <main class="w-full max-w-5xl bg-gray-800 border border-gray-700 rounded-lg shadow-2xl overflow-hidden">
      <div class="grid grid-cols-1 lg:grid-cols-5">
        <section class="lg:col-span-3 px-6 py-8 sm:px-10 sm:py-12">
          <p class="text-sm font-bold text-violet-300 mb-3">42 Seoul Web Project</p>
          <h1 class="text-4xl sm:text-5xl font-extrabold text-white mb-5">ft_transcendence</h1>
          <p class="text-base sm:text-lg leading-7 text-gray-300 max-w-2xl">
            실시간 Pong 게임, 채팅, 친구 관리, 전적 기록을 구현한 42서울 웹 프로젝트입니다.
          </p>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-8">
            <div
              v-for="feature in features"
              :key="feature"
              class="bg-gray-900 border border-gray-700 rounded-md px-4 py-3 text-sm font-semibold text-gray-200"
            >
              {{ feature }}
            </div>
          </div>
        </section>

        <section class="lg:col-span-2 bg-gray-950 border-t lg:border-t-0 lg:border-l border-gray-700 px-6 py-8 sm:px-8 sm:py-12">
          <div class="mb-8">
            <p class="text-sm font-bold text-violet-300 mb-2">Portfolio Demo</p>
            <h2 class="text-2xl font-extrabold text-white mb-3">게스트 계정으로 바로 체험</h2>
            <p class="text-sm leading-6 text-gray-400">
              외부 방문자는 별도 계정 없이 게스트 로그인으로 게임, 채팅, 랭킹 기능을 둘러볼 수 있습니다.
            </p>
          </div>

          <router-link to="/play" class="block mt-6 text-center rounded-md border border-emerald-300 px-4 py-4 font-bold text-emerald-200 hover:bg-gray-700" data-testid="login-arcade-link">로그인 없이 로컬 · AI Pong 시작 ↗</router-link>

          <button
            v-if="isGuestLoginEnabled"
            class="w-full bg-violet-500 hover:bg-violet-600 text-white text-lg font-extrabold rounded-md px-6 py-4 transition duration-200 shadow-lg"
            @click="signinGuest"
          >
            게스트로 체험하기
          </button>
          <p v-else class="bg-gray-800 border border-gray-700 rounded-md px-4 py-3 text-sm text-gray-400">
            현재 게스트 로그인이 비활성화되어 있습니다.
          </p>

          <div class="mt-8 pt-6 border-t border-gray-800">
            <button
              v-if="is42LoginEnabled"
              class="w-full bg-gray-700 hover:bg-gray-600 text-white text-sm font-bold rounded-md px-6 py-3 transition duration-200"
              type="button"
              @click="signin42"
            >
              42 로그인
            </button>
            <button
              v-else
              class="w-full bg-gray-700 text-gray-400 text-sm font-bold rounded-md px-6 py-3 cursor-not-allowed"
              type="button"
              disabled
            >
              42 로그인 비활성화
            </button>
            <p class="mt-3 text-xs leading-5 text-gray-500">
              42 OAuth는 원래 과제 요구사항으로 유지되어 있지만, 공개 데모에서는 게스트 로그인을 이용해 주세요.
            </p>
          </div>

          <div class="mt-8 bg-gray-800 border border-gray-700 rounded-md px-4 py-4">
            <p class="text-xs leading-5 text-gray-400">
              Notion 임베드에서는 로그인 쿠키 정책으로 체험이 제한될 수 있습니다. 새 탭에서 열어 체험해 주세요.
            </p>
            <a
              class="inline-block mt-3 text-sm font-bold text-violet-300 hover:text-violet-200"
              :href="currentUrl"
              target="_blank"
              rel="noopener noreferrer"
            >
              새 탭에서 열기
            </a>
          </div>
        </section>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">

const isGuestLoginEnabled = process.env.VUE_APP_ENABLE_GUEST_LOGIN === 'true'
const is42LoginEnabled = false
const backendBaseUrl = process.env.VUE_APP_BACKEND_URL || window.location.origin
const currentUrl = window.location.href
const features = [
	'실시간 Pong 게임',
	'Socket.IO 기반 채팅',
	'친구/차단/DM',
	'전적/랭킹 기록',
	'Azure VM + Docker Compose',
	'Caddy HTTPS 배포',
]

async function signin42(){
	var url = `${backendBaseUrl}/auth/42`
	document.location = url
}

async function signinGuest(){
	var url = `${backendBaseUrl}/auth/guest`
	document.location = url
}

</script>
