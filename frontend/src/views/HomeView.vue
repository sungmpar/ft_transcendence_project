<template>
  <main class="arcade-page launch-page" data-testid="home">
    <div class="launch-container">
      <header class="launch-header">
        <router-link class="arcade-brand" to="/"><span class="brand-mark" aria-hidden="true">Ⅱ</span> TRANSCENDENCE</router-link>
        <div class="launch-account" @keydown.esc.stop="closeAccount">
          <button ref="accountTrigger" class="launch-account-trigger" :aria-expanded="accountOpen" aria-controls="home-account-links" @click="accountOpen = !accountOpen" data-testid="account-menu">
            <img v-if="avatar && !avatarFailed" :src="avatar" alt="" @error="avatarFailed = true" /><span v-else class="launch-avatar-fallback" aria-hidden="true">{{ initial }}</span>
            <span class="launch-nickname">{{ nickname }}</span><span class="launch-account-label">계정</span><span aria-hidden="true">⌄</span>
          </button>
          <nav v-if="accountOpen" id="home-account-links" class="launch-account-links" aria-label="계정 설정">
            <router-link to="/info">프로필 · 닉네임</router-link><router-link to="/tfa">2단계 인증</router-link><button :disabled="loggingOut" @click="logout">{{ loggingOut ? '로그아웃 중…' : '로그아웃' }}</button>
          </nav>
        </div>
      </header>
      <section class="launch-intro"><p class="eyebrow">플레이할 시간</p><h1>지금, 한 판 시작할까요?</h1><p>한 키보드로 친구와 대결하거나, AI와 연습하거나, 온라인에서 다른 플레이어와 겨뤄보세요.</p></section>
      <LaunchPanel authenticated>
      <template #community><nav class="launch-community" aria-label="친구와 서비스">
        <span>함께 즐기기</span>
        <button @click="openFriends" data-testid="home-friends">친구 초대 <small>친구를 먼저 선택하세요</small></button>
        <router-link to="/spectate">경기 관전 <small>진행 중인 경기 보기</small></router-link>
        <router-link to="/tempchat">채팅 <small>채널 · 1:1 대화</small></router-link>
        <router-link to="/board">내 전적 <small>온라인 경기 기록</small></router-link>
      </nav></template>
      </LaunchPanel>
    </div>
  </main>
</template>
<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import router from '@/router';
import store from '@/store';
import LaunchPanel from '@/components/arcade/LaunchPanel.vue';
import { logoutSession, openFriends } from '@/arcade/auth-session';
import '@/arcade/arcade.css';
import '@/arcade/launch.css';
const accountOpen = ref(false);
const accountTrigger = ref<HTMLButtonElement | null>(null);
const avatarFailed = ref(false);
const loggingOut = ref(false);
const nickname = computed(() => store.getters.usernickname || '플레이어');
const initial = computed(() => Array.from(nickname.value as string)[0]?.toUpperCase() || 'P');
const avatar = computed(() => store.getters.userid ? `${process.env.VUE_APP_BACKEND_URL || window.location.origin}/user/image/${store.getters.userid}` : '');
async function closeAccount() { accountOpen.value = false; await nextTick(); accountTrigger.value?.focus(); }
async function logout() {
  if (loggingOut.value) return;
  loggingOut.value = true;
  const result = await logoutSession();
  await router.replace(result.serverConfirmed ? '/login' : '/login?logout=unconfirmed');
  loggingOut.value = false;
}
</script>
