<template>
  <SpectateSlider :loading="roomsLoading" :error="roomsError" @retry="findRoomList" />
  <OnlineGameShell
    title="경기 관전"
    :status="status"
    :active="active"
    :waiting="waiting"
    :result="result"
    :recovered-result="recoveredResult"
    :mode="mode"
    v-model:map="map"
    layout="arrows"
    spectator
    @context-ready="setContext"
  >
    <template #start-action
      ><button
        class="arcade-button primary mint-button"
        :disabled="waiting || !connected"
        @click="store.getters.room.roomId ? spectateGame() : findRoomList()"
        data-testid="online-play"
      >
        {{ store.getters.room.roomId ? "선택한 경기 관전" : "경기 찾기" }}
      </button></template
    >
    <template #actions
      ><p v-if="connectionState.message" class="power-note" role="status" data-testid="online-connection-notice">{{ connectionState.message }}</p
      ><button v-if="connectionState.message" class="arcade-button" :disabled="connectionState.pending" @click="retryConnection" data-testid="online-reconnect">{{ connectionState.pending ? '연결 확인 중…' : '연결 다시 확인' }}</button
      ><button
        class="arcade-button"
        :disabled="waiting || !connected"
        @click="findRoomList"
      >
        경기 목록</button
      ><button
        class="arcade-button"
        :disabled="waiting || !connected"
        @click="spectateGame"
      >
        선택한 경기 보기
      </button></template
    >
    <template #result-actions
      ><button
        class="arcade-button primary mint-button"
        :disabled="!connected"
        @click="findRoomList"
        data-testid="online-rematch"
      >
        다른 경기 찾기 ↻
      </button></template
    >
  </OnlineGameShell>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from "vue";
import { createRouteGameSocket } from "@/arcade/route-game-socket";
import { ConnectionRetry } from "@/arcade/connection-retry";
import { isMatchEnded, ReadyMessage, RecoveredResult, SessionSyncResponse } from "../../../shared/protocol";
import { GameplayService } from "@/plugins/gamePlayService";
import OnlineGameShell from "@/components/game/OnlineGameShell.vue";
import SpectateSlider from "@/components/game/SpectateSlider.vue";
import store from "@/store";
import { OnlineResultNotice } from "@/arcade/online-result";
import { SessionRecovery, recoveryMessage } from "@/arcade/session-recovery";

const socket = createRouteGameSocket();
const connectionState = ref({ pending: false, message: '' });
const connectionRetry = new ConnectionRetry(socket, (state) => { connectionState.value = state; });
const active = ref(false),
  waiting = ref(false),
  connected = ref(socket?.connected || false);
const status = ref("경기 목록에서 관전할 방을 선택하세요."),
  result = ref(""),
  mode = ref(false),
  map = ref("black");
let context: CanvasRenderingContext2D | undefined;
let pendingReady: ReadyMessage | undefined;
const persistence = new OnlineResultNotice();
let disposed = false;
let desiredRoom = '';
let retryDesiredRoom = false;
const recoveredResult = ref<RecoveredResult | null>(null);
const recovery = new SessionRecovery(socket, 'spectator', onRecovery);
function retryConnection() {
  if (disposed || socket.connected || connectionState.value.pending) return;
  retryDesiredRoom = Boolean(desiredRoom);
  connectionRetry.retry();
}
function onRecovery(value: SessionSyncResponse | null) {
  if (disposed) return;
  waiting.value = false;
  if (value && 'ready' in value) {
    onReady(value.ready); status.value = recoveryMessage(value); return;
  }
  pendingReady = undefined;
  GameplayService.disposeFor(context?.canvas);
  store.commit('setOnlineState', null);
  active.value = false;
  status.value = recoveryMessage(value);
  if (value && 'result' in value) {
    recoveredResult.value = value.result;
    persistence.reset(value.matchId);
    persistence.receive({ roomId: value.matchId, status: value.status });
    result.value = `${value.result.winnerName} 승리!`;
    if (value.status === 'saved' || value.status === 'failed') recovery.finish(value.matchId);
  } else result.value = '';
}
const roomsLoading = ref(false), roomsError = ref('');
let roomsTimeout: ReturnType<typeof setTimeout> | undefined;
function cancelRoomRequest() {
  if (roomsTimeout !== undefined) clearTimeout(roomsTimeout);
  roomsTimeout = undefined;
  roomsLoading.value = false;
}
function failRoomRequest() {
  if (!roomsLoading.value) return;
  cancelRoomRequest();
  roomsError.value = '경기 목록을 불러오지 못했습니다. 연결을 확인하고 다시 시도해 주세요.';
}
function setContext(value: CanvasRenderingContext2D) {
  if (disposed) return;
  context = value;
  if (pendingReady) startGame(pendingReady);
}
function setStatus(message: string) {
  if (disposed) return;
  status.value = message;
}
function startGame(data: ReadyMessage) {
  if (disposed) return;
  if (!context) {
    pendingReady = data;
    return;
  }
  pendingReady = undefined;
  GameplayService.start(context, map.value, data, setStatus);
}
function onReady(value: unknown) {
  if (disposed) return;
  if (!recovery.acceptReady(value)) return;
  desiredRoom = value.roomId;
  recoveredResult.value = null;
  persistence.reset(value.roomId);
  store.commit("setRoom", value);
  mode.value = value.roomMode;
  active.value = true;
  waiting.value = false;
  result.value = "";
  store.commit("setIsSearching", false);
  startGame(value);
}
function onEnd(value: unknown) {
  if (disposed || persistence.status === "aborted") return;
  if (!isMatchEnded(value) || !recovery.finish(value.roomId)) return;
  const winner =
    value.winner === "left"
      ? store.getters.room.leftName
      : store.getters.room.rightName;
  result.value = `${winner || (value.winner === "left" ? "P1" : "P2")} 승리!`;
  active.value = false;
  waiting.value = false;
  status.value = persistence.message;
  GameplayService.stop(value.winner);
}
function onRooms(value: unknown) {
  if (disposed || !roomsLoading.value) return;
  if (!Array.isArray(value)) { failRoomRequest(); return; }
  cancelRoomRequest();
  roomsError.value = '';
  store.commit("setRoomList", value);
}
function onError(value: unknown) {
  if (disposed) return;
  failRoomRequest();
  if (connectionRetry.reject(value)) {
    connected.value = false; waiting.value = false;
    status.value = connectionState.value.message;
    return;
  }
  status.value =
    value &&
    typeof value === "object" &&
    "message" in value &&
    typeof value.message === "string"
      ? value.message
      : "관전 요청을 처리하지 못했습니다.";
  waiting.value = false;
}
function onConnect() {
  if (disposed) return;
  if (!connectionRetry.connected()) return;
  connected.value = true;
  if (desiredRoom && (active.value || waiting.value || retryDesiredRoom)) {
    retryDesiredRoom = false;
    waiting.value = true; recovery.resume(desiredRoom); return;
  }
  status.value = active.value
    ? "다시 연결됐습니다. 관전 상태를 확인합니다."
    : "경기 목록에서 관전할 방을 선택하세요.";
}
function onDisconnect() {
  if (disposed) return;
  failRoomRequest();
  recovery.cancel();
  connected.value = false;
  status.value = connectionState.value.message || "연결이 끊겼습니다. 재연결을 기다립니다.";
}
function findRoomList() {
  if (roomsLoading.value) return;
  store.commit("setIsSearching", true);
  roomsError.value = '';
  store.commit("setRoomList", []);
  if (!socket?.connected) {
    roomsError.value = '서버에 연결되지 않아 경기 목록을 확인하지 못했습니다.';
    return;
  }
  if (active.value) socket.emit("end");
  GameplayService.dispose();
  active.value = false;
  result.value = "";
  pendingReady = undefined;
  store.commit("setOnlineState", null);
  clearDisplay();
  roomsLoading.value = true;
  roomsTimeout = setTimeout(() => {
    if (!disposed) failRoomRequest();
  }, 5000);
  socket.emit("roomlist");
}
function spectateGame() {
  if (!socket?.connected || waiting.value) return;
  const roomId = store.getters.room.roomId;
  if (!roomId) {
    status.value = "먼저 경기 목록에서 관전할 방을 선택해 주세요.";
    return;
  }
  result.value = "";
  waiting.value = true;
  desiredRoom = roomId;
  recovery.expect(roomId);
  persistence.reset(roomId);
  status.value = "서버의 현재 경기 상태를 기다립니다.";
  recovery.resume(roomId);
}
function onSessionStatus(value: unknown) {
  if (disposed || !active.value || !persistence.abort(value)) return;
  pendingReady = undefined;
  GameplayService.dispose();
  active.value = false;
  waiting.value = false;
  result.value = "경기가 중단되었습니다.";
  status.value = persistence.message;
}
function onResultStatus(value: unknown) {
  if (disposed || !persistence.receive(value)) return;
  status.value = persistence.message;
}
function clearDisplay() {
  recoveredResult.value = null;
  desiredRoom = "";
  retryDesiredRoom = false;
  recovery.clear();
  persistence.reset();
  store.commit("setOnlineMetrics", {
    ackRoundTripMs: null,
    transportRoundTripMs: null,
    snapshots: 0,
    inputMessages: 0,
    fps: 0,
    bufferDepth: 0,
    displayDelayMs: 0,
    underflows: 0,
  });
  store.commit("setGameData", {
    ball: { x: 0, y: 0 },
    leftBar: { x: 0, y: 0, power: false },
    rightBar: { x: 0, y: 0, power: false },
    score: { left: 0, right: 0 },
  });
  store.commit("setRoom", {
    roomId: "",
    leftName: "",
    rightName: "",
    roomMode: false,
  });
}
socket?.on("setData", onReady);
socket?.on("ready", onReady);
socket?.on("matchEnded", onEnd);
socket?.on("resultStatus", onResultStatus);
socket?.on("sessionStatus", onSessionStatus);
socket?.on("roomlist", onRooms);
socket?.on("error", onError);
socket?.on("exception", onError);
socket?.on("connect_error", onError);
socket?.on("connect", onConnect);
socket?.on("disconnect", onDisconnect);
clearDisplay();
store.commit("setOnlineState", null);
store.commit("setIsSearching", false);
watch(() => store.getters.isSearching, (open) => {
  if (!open) cancelRoomRequest();
});
watch(() => store.getters.room.roomId, (roomId) => {
  if (roomId && roomId !== desiredRoom) {
    desiredRoom = roomId;
    pendingReady = undefined;
    recovery.expect(roomId);
  }
}, { flush: 'sync' });
onMounted(() => socket.connect());
onUnmounted(() => {
  disposed = true;
  connectionRetry.dispose();
  recovery.dispose();
  cancelRoomRequest();
  pendingReady = undefined;
  GameplayService.disposeFor(context?.canvas);
  socket?.off("setData", onReady);
  socket?.off("ready", onReady);
  socket?.off("matchEnded", onEnd);
  socket?.off("resultStatus", onResultStatus);
  socket?.off("sessionStatus", onSessionStatus);
  socket?.off("roomlist", onRooms);
  socket?.off("error", onError);
  socket?.off("exception", onError);
  socket?.off("connect_error", onError);
  socket?.off("connect", onConnect);
  socket?.off("disconnect", onDisconnect);
  if (socket.connected) socket.emit("end");
  socket?.close();
  if (store.getters.gameSocket !== socket) return;
  store.commit("setGameSocket", null);
  clearDisplay();
  store.commit("setOnlineState", null);
  store.commit("setIsSearching", false);
});
</script>
