<template>
  <nav class="service-rail" aria-label="서비스 메뉴">
    <div class="rail-scroll">
      <router-link to="/" class="rail-link" :aria-current="route.name === 'home' ? 'page' : undefined" aria-label="Home" title="Home"><font-awesome-icon icon="fa-solid fa-home" /><span>Home</span></router-link>
      <router-link to="/play" class="rail-link" aria-label="로컬 및 AI 플레이" title="로컬 · AI"><strong>2P</strong><span>로컬 · AI</span></router-link>
      <router-link to="/game" class="rail-link" :aria-current="route.name === 'game' ? 'page' : undefined" aria-label="온라인 대전" title="온라인 대전"><font-awesome-icon icon="fa-solid fa-table-tennis-paddle-ball" /><span>대전</span></router-link>
      <div class="rail-divider" />
      <button type="button" class="rail-link" :aria-expanded="store.getters.openFriends" aria-controls="friends-drawer" aria-label="친구 목록 열기" title="친구" @click="openFriends"><font-awesome-icon icon="fa-solid fa-user-group" /><span>친구</span></button>
      <router-link to="/tempinvitepage" class="rail-link" :aria-current="route.name === 'invite' ? 'page' : undefined" aria-label="친구 초대" title="친구 초대"><font-awesome-icon icon="fa-solid fa-handshake" /><span>초대</span></router-link>
      <router-link to="/tempwatchpage" class="rail-link" :aria-current="route.name === 'spectate' ? 'page' : undefined" aria-label="경기 관전" title="경기 관전"><font-awesome-icon icon="fa-solid fa-video-camera" /><span>관전</span></router-link>
      <router-link to="/tempchat" class="rail-link" :aria-current="route.name === 'chat' ? 'page' : undefined" aria-label="채팅" title="채팅"><font-awesome-icon icon="fa-solid fa-comment" /><span>채팅</span></router-link>
      <router-link to="/board" class="rail-link" :aria-current="route.name === 'board' ? 'page' : undefined" aria-label="전적과 랭킹" title="전적과 랭킹"><font-awesome-icon icon="fa-solid fa-list" /><span>전적</span></router-link>
      <div class="rail-divider" />
      <router-link to="/info" class="rail-link" :aria-current="route.name === 'info' ? 'page' : undefined" aria-label="프로필 설정" title="프로필 설정"><font-awesome-icon icon="fa-solid fa-user-large" /><span>프로필</span></router-link>
      <router-link to="/tfa" class="rail-link" :aria-current="route.name === 'tfa' ? 'page' : undefined" aria-label="2FA 보안 설정" title="2FA 보안 설정"><font-awesome-icon icon="fa-solid fa-lock" /><span>2FA</span></router-link>
      <button type="button" class="rail-link" :disabled="loggingOut" aria-label="로그아웃" title="로그아웃" @click="logout"><font-awesome-icon icon="fa-solid fa-sign-out" /><span>{{ loggingOut ? '정리 중' : '로그아웃' }}</span></button>
    </div>
  </nav>
</template>
<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import store from '@/store';
import { logoutSession, openFriends } from '@/arcade/auth-session';
const route = useRoute(), router = useRouter();
const loggingOut = ref(false);
async function logout() {
  if (loggingOut.value) return;
  loggingOut.value = true;
  const { serverConfirmed } = await logoutSession();
  await router.replace(serverConfirmed ? '/login' : '/login?logout=unconfirmed');
  loggingOut.value = false;
}
</script>
<style scoped>
.service-rail { position:fixed; inset:0 auto 0 0; width:80px; background:#101725; color:#9ca9c0; border-right:1px solid #293347; z-index:5; }
.rail-scroll { height:100%; overflow-y:auto; padding:12px 8px; scrollbar-width:thin; }
.rail-link { display:flex; width:100%; min-height:58px; flex-direction:column; justify-content:center; align-items:center; gap:5px; border-radius:9px; margin:3px 0; text-align:center; }
.rail-link svg,.rail-link strong { font-size:18px; }
.rail-link span { font-size:10px; font-weight:650; line-height:1.2; }
.rail-link:hover,.rail-link[aria-current="page"] { color:#92f0d1; background:#1c2e35; }
.rail-link:focus-visible { outline:3px solid #92f0d1; outline-offset:-3px; color:#eef2ff; }
.rail-link:disabled { opacity:.6; }
.rail-divider { height:1px; background:#293347; margin:10px 8px; }
</style>
