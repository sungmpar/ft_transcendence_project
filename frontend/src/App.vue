<template>
  <router-view v-if="route.meta.publicArcade || route.name === 'login'" :key="route.fullPath" />
  <div v-else class="service-layout">
    <aside class="service-rail"><side-bar /></aside>
    <div class="service-content"><router-view /></div>
    <friends-slider />
  </div>
</template>
<script setup lang="ts">
import SideBar from '@/components/SideBar.vue';
import FriendsSlider from '@/components/friends/FriendsSlider.vue';
import { useRoute } from 'vue-router';
const route = useRoute();
</script>
<style>
.service-layout { display: flex; min-height: 100vh; background: #0b101b; }
.service-rail { flex: 0 0 80px; width: 80px; }
.service-content { position: relative; flex: 1 1 0; min-width: 0; }
</style>
