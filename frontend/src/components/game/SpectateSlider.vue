<template>
  <TransitionRoot as="template" :show="store.getters.isSearching">
    <Dialog as="div" class="spectate-dialog" @close="closeSlider">
      <div class="spectate-backdrop" aria-hidden="true" />
      <div class="spectate-position">
        <DialogPanel class="spectate-panel">
          <header><DialogTitle>경기 목록</DialogTitle><button type="button" aria-label="경기 목록 닫기" class="spectate-close" @click="closeSlider">✕</button></header>
          <p class="spectate-intro">진행 중인 경기를 선택한 뒤 ‘선택한 경기 관전’을 누르세요. 관전자는 경기를 조작하지 않습니다.</p>
          <p v-if="loading" role="status" data-testid="spectator-loading">진행 중인 경기를 불러오는 중…</p>
          <div v-else-if="error" role="status"><p data-testid="spectator-list-error">{{ error }}</p><button type="button" class="spectate-retry" @click="$emit('retry')">다시 시도</button></div>
          <p v-else-if="!store.getters.roomList.length" role="status" data-testid="spectator-empty">현재 관전할 경기가 없습니다. 두 플레이어가 대전을 시작하면 목록에 표시됩니다.</p>
          <ul v-else class="spectate-list">
            <li v-for="room in store.getters.roomList" :key="room.roomId"><button type="button" @click="insertRoomData(room)"><span>{{ room.leftName }} <span class="spectate-vs">vs</span> {{ room.rightName }}</span><span class="spectate-select">선택 →</span></button></li>
          </ul>
        </DialogPanel>
      </div>
    </Dialog>
  </TransitionRoot>
</template>
<script setup lang="ts">
import { defineEmits, defineProps } from 'vue';
import store from '@/store';
import { Dialog, DialogPanel, DialogTitle, TransitionRoot } from '@headlessui/vue';
defineProps<{ loading: boolean; error: string }>();
defineEmits<{ (event: 'retry'): void }>();
interface ListedRoom { roomId: string; leftName: string; rightName: string; roomMode?: boolean }
function closeSlider() { store.commit('setIsSearching', false); }
function insertRoomData(room: ListedRoom) {
  store.commit('setRoom', room);
  closeSlider();
}
</script>
<style scoped>
.spectate-dialog { position:relative; z-index:40; color:#eef2ff; }
.spectate-backdrop { position:fixed; inset:0; background:rgb(0 0 0 / .6); }
.spectate-position { position:fixed; inset:0; padding-left:80px; display:flex; justify-content:flex-end; pointer-events:none; }
.spectate-panel { box-sizing:border-box; width:min(430px,100%); overflow-y:auto; background:#141c2b; padding:24px; border-left:1px solid #39475f; pointer-events:auto; }
.spectate-panel header { display:flex; justify-content:space-between; align-items:center; font-size:23px; font-weight:750; margin-bottom:20px; }
.spectate-panel p { font-size:14px; line-height:1.8; color:#adb9ce; }
.spectate-intro { margin-bottom:24px; }
.spectate-panel button:focus-visible { outline:3px solid #92f0d1; outline-offset:3px; }
.spectate-close { width:40px; height:40px; border:1px solid #4a5871; border-radius:8px; font-size:17px; }
.spectate-retry { margin-top:16px; color:#92f0d1; padding:10px 15px; border:1px solid #4a5871; border-radius:7px; }
.spectate-list { list-style:none; margin:0; padding:0; }
.spectate-list li { border-top:1px solid #293347; }
.spectate-list button { width:100%; min-width:0; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; text-align:left; padding:22px 0; }
.spectate-list button>span:first-child { overflow-wrap:anywhere; }
.spectate-vs { color:#9ca9c0; font-size:13px; }
.spectate-select { color:#92f0d1; font-size:13px; }
@media(max-width:480px) { .spectate-panel { padding:18px; } }
</style>
