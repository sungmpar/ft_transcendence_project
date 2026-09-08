<template>
  <OnlineGameShell
    title="랜덤 매칭"
    :status="status"
    :active="active"
    :waiting="waiting"
    :result="result"
    v-model:mode="mode"
    v-model:map="map"
    v-model:layout="layout"
    @context-ready="setContext"
  >
    <template #start-action
      ><button
        class="arcade-button primary mint-button"
        :disabled="waiting || !connected"
        @click="joinToGame"
        data-testid="online-play"
      >
        {{ waiting ? "매칭 중…" : "상대 찾기" }}
      </button></template
    >
    <template #actions
      ><button
        class="arcade-button"
        :disabled="active || waiting || !connected"
        @click="joinToGame"
      >
        {{ result ? "다시 매칭" : "상대 찾기" }}</button
      ><button v-if="waiting" class="quiet-button" @click="cancelWaiting">
        매칭 취소
      </button></template
    >
    <template #result-actions
      ><button
        class="arcade-button primary mint-button"
        :disabled="!connected"
        @click="joinToGame"
        data-testid="online-rematch"
      >
        다시 매칭 ↻
      </button></template
    >
  </OnlineGameShell>
</template>

<script setup lang="ts">
import { onUnmounted, ref, watch } from "vue";
import type { Socket } from "socket.io-client";
import { isReadyMessage, ReadyMessage } from "../../../shared/protocol";
import { GameplayService } from "@/plugins/gamePlayService";
import OnlineGameShell from "@/components/game/OnlineGameShell.vue";
import store from "@/store";
import { OnlineResultNotice } from "@/arcade/online-result";

const socket = store.getters.gameSocket as Socket | null;
const active = ref(false);
const waiting = ref(false);
const connected = ref(socket?.connected || false);
const result = ref("");
const status = ref(
  connected.value
    ? "규칙을 고르고 상대 찾기를 눌러 주세요."
    : "게임 서버에 연결 중입니다."
);
const mode = ref(true);
const map = ref("black");
const layout = ref<"arrows" | "wasd">("arrows");
let context: CanvasRenderingContext2D | undefined;
let pendingReady: ReadyMessage | undefined;
const persistence = new OnlineResultNotice();
let disposed = false;
let ownSide: ReadyMessage["side"] = "spectator";

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
  GameplayService.useKeyLayout(layout.value);
}
function onReady(value: unknown) {
  if (disposed) return;
  if (!isReadyMessage(value)) {
    status.value = "서버 경기 정보가 올바르지 않아 적용하지 않았습니다.";
    return;
  }
  ownSide = value.side;
  mode.value = value.roomMode;
  persistence.reset(value.roomId);
  store.commit("setRoom", value);
  active.value = true;
  waiting.value = false;
  result.value = "";
  startGame(value);
}
function onEnd(value: unknown) {
  if (disposed || persistence.status === "aborted") return;
  if (value !== "left" && value !== "right") return;
  active.value = false;
  waiting.value = false;
  result.value = ownSide === value ? "승리했습니다!" : "패배했습니다.";
  status.value = persistence.message;
  GameplayService.stop(value);
}
function onError(value: unknown) {
  if (disposed) return;
  status.value =
    value &&
    typeof value === "object" &&
    "message" in value &&
    typeof value.message === "string"
      ? value.message
      : "게임 요청을 처리하지 못했습니다.";
  waiting.value = false;
}
function onConnect() {
  if (disposed) return;
  connected.value = true;
  status.value = active.value
    ? "다시 연결됐습니다. 경기 상태를 확인합니다."
    : "연결됐습니다. 상대를 찾을 수 있습니다.";
}
function onDisconnect() {
  if (disposed) return;
  connected.value = false;
  waiting.value = false;
  status.value = "연결이 끊겼습니다. 재연결을 기다립니다.";
}
function joinToGame() {
  if (!socket?.connected || active.value || waiting.value) return;
  GameplayService.dispose();
  store.commit("setOnlineState", null);
  clearDisplay();
  result.value = "";
  waiting.value = true;
  status.value =
    "상대를 기다립니다. 두 플레이어가 Power를 선택하면 Power 규칙으로 진행합니다.";
  socket.emit("matchmaking", {
    userId: store.getters.userid,
    mode: mode.value,
  });
}
function cancelWaiting() {
  socket?.emit("end");
  waiting.value = false;
  status.value = "매칭을 취소했습니다.";
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
    roomMode: mode.value,
  });
}
watch(layout, (value) => GameplayService.useKeyLayout(value));
socket?.on("ready", onReady);
socket?.on("end", onEnd);
socket?.on("resultStatus", onResultStatus);
socket?.on("sessionStatus", onSessionStatus);
socket?.on("error", onError);
socket?.on("exception", onError);
socket?.on("connect", onConnect);
socket?.on("disconnect", onDisconnect);
socket?.on("connect_error", onError);
clearDisplay();
store.commit("setOnlineState", null);
onUnmounted(() => {
  disposed = true;
  pendingReady = undefined;
  GameplayService.dispose();
  socket?.off("ready", onReady);
  socket?.off("end", onEnd);
  socket?.off("resultStatus", onResultStatus);
  socket?.off("sessionStatus", onSessionStatus);
  socket?.off("error", onError);
  socket?.off("exception", onError);
  socket?.off("connect", onConnect);
  socket?.off("disconnect", onDisconnect);
  socket?.off("connect_error", onError);
  socket?.emit("end");
  socket?.close();
  if (store.getters.gameSocket === socket) store.commit("setGameSocket", null);
  clearDisplay();
  store.commit("setOnlineState", null);
});
</script>
