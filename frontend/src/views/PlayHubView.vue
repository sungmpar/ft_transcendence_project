<template>
  <main class="arcade-page launch-page" data-testid="play-hub">
    <div class="launch-container">
      <header class="launch-header">
        <router-link class="arcade-brand" to="/play"><span class="brand-mark" aria-hidden="true">Ⅱ</span> TRANSCENDENCE</router-link>
        <router-link class="quiet-link" to="/login">온라인 로그인 ↗</router-link>
      </header>
      <section class="launch-intro"><p class="eyebrow">바로 플레이</p><h1>지금, 한 판 시작할까요?</h1><p>옆자리 친구와, 컴퓨터와, 온라인 상대와.</p></section>
      <LaunchPanel>
      <template #community><nav class="launch-community" aria-label="온라인 서비스">
        <span>함께 즐기기</span>
        <router-link :to="{ path: '/login', query: { next: '/invite' } }">친구 초대 <small>로그인 후 친구 선택</small></router-link>
        <router-link :to="{ path: '/login', query: { next: '/spectate' } }">경기 관전 <small>진행 중인 경기 보기</small></router-link>
      </nav></template>
      </LaunchPanel>
    </div>
  </main>
</template>
<script setup lang="ts">
import LaunchPanel from '@/components/arcade/LaunchPanel.vue';
import '@/arcade/arcade.css';
import '@/arcade/launch.css';
</script>
