<template>
  <TransitionRoot as="template" :show="store.getters.openFriends">
    <Dialog as="div" class="friends-dialog" @close="closeSlider">
      <div class="friends-backdrop" aria-hidden="true" />
      <div class="friends-position">
        <DialogPanel id="friends-drawer" class="friends-panel">
          <header><DialogTitle>친구</DialogTitle><button type="button" class="friends-close" aria-label="친구 목록 닫기" @click="closeSlider">✕</button></header>
          <p class="friends-intro">함께할 친구를 골라 초대 화면으로 이동하세요. 상대도 온라인 게임에 접속해야 초대를 받을 수 있습니다.</p>
          <p v-if="loading" role="status" data-testid="friends-loading">친구 목록을 불러오는 중…</p>
          <div v-else-if="loadError" role="status" class="friends-error"><p data-testid="friends-error">친구 목록을 불러오지 못했습니다.</p><button type="button" @click="loadFriends">다시 시도</button></div>
          <p v-else-if="!friends.length" role="status" data-testid="friends-empty">아직 등록한 친구가 없습니다. 채팅에서 상대 프로필을 열어 친구로 추가할 수 있어요.</p>
          <ul v-else class="friends-list">
            <li v-for="friend in friends" :key="friend.id">
              <div class="friend-identity"><img v-if="!brokenImages[friend.id]" :src="avatar(friend.id)" alt="" @error="brokenImages[friend.id] = true" /><span v-else class="friend-avatar" aria-hidden="true">{{ friend.nickname?.slice(0, 1) || '?' }}</span><div><strong>{{ friend.nickname }}</strong><p>{{ friend.status === 'online' ? '온라인' : friend.status === 'ingame' ? '게임 중' : '오프라인' }}</p></div></div>
              <div class="friend-actions"><button type="button" :aria-label="`${friend.nickname} 채팅하기`" @click="goChat(friend.id)">채팅</button><button type="button" :aria-label="`${friend.nickname} 초대하기`" @click="goPong(friend.id, friend.nickname)">대전 초대 →</button></div>
            </li>
          </ul>
        </DialogPanel>
      </div>
    </Dialog>
  </TransitionRoot>
</template>
<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue';
import axios from 'axios';
import router from '@/router';
import store from '@/store';
import { Dialog, DialogPanel, DialogTitle, TransitionRoot } from '@headlessui/vue';
interface Friend { id: number; nickname: string; status: string }
const friends = computed(() => store.getters.friends as Friend[]);
const loading = ref(false), loadError = ref(false), brokenImages = ref<Record<number, boolean>>({});
const backendBaseUrl = process.env.VUE_APP_BACKEND_URL || window.location.origin;
let requestId = 0;
let controller: AbortController | undefined;
async function loadFriends() {
  controller?.abort(); controller = new AbortController();
  const ownRequest = ++requestId;
  loading.value = true; loadError.value = false;
  store.commit('setFriends', []);
  try {
    const response = await axios.get('/user/friends', { signal: controller.signal, timeout: 5000 });
    if (ownRequest !== requestId) return;
    if (!Array.isArray(response.data)) throw new Error('Invalid friends response');
    store.commit('setFriends', response.data);
  } catch {
    if (ownRequest === requestId) loadError.value = true;
  } finally {
    if (ownRequest === requestId) loading.value = false;
  }
}
function closeSlider() { store.commit('setOpenFriends', false); }
function goChat(friendId: number) {
  closeSlider();
  router.push({ name: 'chat', params: { friendId }, force: true });
}
function goPong(friendId: number, friendName: string) {
  closeSlider();
  // The pinned Vue Router 4.1.3 preserves these params through the temp route.
  router.push({ name: 'tempinvitepage', params: { friendId, friendName }, force: true });
}
function avatar(id: number) { return `${backendBaseUrl}/user/image/${id}`; }
watch(() => store.getters.openFriends, (open) => {
  if (open) void loadFriends();
  else { ++requestId; controller?.abort(); loading.value = false; }
}, { immediate: true });
onUnmounted(() => { ++requestId; controller?.abort(); });
</script>
<style scoped>
.friends-dialog { position:relative; z-index:40; color:#eef2ff; }
.friends-backdrop { position:fixed; inset:0; background:rgb(0 0 0 / .6); }
.friends-position { position:fixed; inset:0; padding-left:80px; display:flex; pointer-events:none; }
.friends-panel { box-sizing:border-box; width:min(420px,100%); overflow-y:auto; background:#141c2b; padding:24px; pointer-events:auto; border-right:1px solid #39475f; }
.friends-panel header { display:flex; justify-content:space-between; align-items:center; font-size:23px; font-weight:750; margin-bottom:20px; }
.friends-panel button:focus-visible { outline:3px solid #92f0d1; outline-offset:3px; }
.friends-close { width:40px; height:40px; border:1px solid #4a5871; border-radius:8px; font-size:17px; }
.friends-panel p { line-height:1.7; color:#adb9ce; font-size:14px; }
.friends-intro { margin-bottom:24px; }
.friends-list { list-style:none; margin:0; padding:0; }
.friends-list li { padding:20px 0; border-top:1px solid #293347; }
.friend-identity { display:flex; gap:12px; align-items:center; min-width:0; }
.friend-identity>div { min-width:0; overflow-wrap:anywhere; }
.friend-identity img,.friend-avatar { width:36px; height:36px; flex-shrink:0; border-radius:50%; background:#293347; object-fit:cover; display:grid; place-items:center; }
.friend-actions { display:flex; flex-wrap:wrap; gap:10px; margin-top:14px; }
.friend-actions button,.friends-error button { border:1px solid #4a5871; padding:9px 14px; border-radius:7px; color:#92f0d1; font-size:13px; }
.friends-error button { margin-top:16px; }
@media(max-width:480px) { .friends-panel { padding:18px; } }
</style>
