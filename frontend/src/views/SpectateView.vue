<template>
  <SpectateSlider />
  <OnlineGameShell
    title="경기 관전"
    :status="status"
    :active="active"
    :waiting="waiting"
    :result="result"
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
import { onUnmounted, ref } from "vue";
import type { Socket } from "socket.io-client";
import { isReadyMessage, ReadyMessage } from "../../../shared/protocol";
import { GameplayService } from "@/plugins/gamePlayService";
import OnlineGameShell from "@/components/game/OnlineGameShell.vue";
import SpectateSlider from "@/components/game/SpectateSlider.vue";
import store from "@/store";
import { OnlineResultNotice } from "@/arcade/online-result";

const socket = store.getters.gameSocket as Socket | null;
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
  if (!isReadyMessage(value) || value.side !== "spectator") {
    status.value = "서버 관전 정보가 올바르지 않아 적용하지 않았습니다.";
    waiting.value = false;
    return;
  }
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
  if (value !== "left" && value !== "right") return;
  const winner =
    value === "left"
      ? store.getters.room.leftName
      : store.getters.room.rightName;
  result.value = `${winner || (value === "left" ? "P1" : "P2")} 승리!`;
  active.value = false;
  waiting.value = false;
  status.value = persistence.message;
  GameplayService.stop(value);
}
function onRooms(value: unknown) {
  if (disposed) return;
  if (Array.isArray(value)) store.commit("setRoomList", value);
}
function onFinish(value: unknown) {
  if (disposed) return;
  if (
    !value ||
    typeof value !== "object" ||
    !("leftName" in value) ||
    !("rightName" in value) ||
    !("leftScore" in value) ||
    !("rightScore" in value) ||
    typeof value.leftName !== "string" ||
    typeof value.rightName !== "string" ||
    !Number.isSafeInteger(value.leftScore) ||
    !Number.isSafeInteger(value.rightScore) ||
    (value.leftScore as number) < 0 ||
    (value.rightScore as number) < 0
  ) {
    status.value = "저장된 경기 결과 형식을 확인하지 못했습니다.";
    waiting.value = false;
    return;
  }
  GameplayService.dispose();
  store.commit("setOnlineState", null);
  persistence.reset(store.getters.room.roomId);
  persistence.receive({ roomId: store.getters.room.roomId, status: "saved" });
  store.commit("setRoomData", value);
  active.value = false;
  waiting.value = false;
  result.value = `${value.leftName} 승리!`;
  status.value = "저장된 완료 경기 결과입니다.";
}
function onError(value: unknown) {
  if (disposed) return;
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
  connected.value = true;
  status.value = active.value
    ? "다시 연결됐습니다. 관전 상태를 확인합니다."
    : "경기 목록에서 관전할 방을 선택하세요.";
}
function onDisconnect() {
  if (disposed) return;
  connected.value = false;
  waiting.value = false;
  status.value = "연결이 끊겼습니다. 재연결을 기다립니다.";
}
function findRoomList() {
  if (!socket?.connected) return;
  if (active.value) socket.emit("end");
  GameplayService.dispose();
  active.value = false;
  result.value = "";
  pendingReady = undefined;
  store.commit("setOnlineState", null);
  clearDisplay();
  socket.emit("roomlist");
  store.commit("setIsSearching", true);
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
  persistence.reset(roomId);
  status.value = "서버의 현재 경기 상태를 기다립니다.";
  socket.emit("spectate", { id: roomId });
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
    roomMode: false,
  });
}
socket?.on("setData", onReady);
socket?.on("ready", onReady);
socket?.on("end", onEnd);
socket?.on("resultStatus", onResultStatus);
socket?.on("sessionStatus", onSessionStatus);
socket?.on("finish", onFinish);
socket?.on("roomlist", onRooms);
socket?.on("error", onError);
socket?.on("exception", onError);
socket?.on("connect_error", onError);
socket?.on("connect", onConnect);
socket?.on("disconnect", onDisconnect);
clearDisplay();
store.commit("setOnlineState", null);
store.commit("setIsSearching", false);
onUnmounted(() => {
  disposed = true;
  pendingReady = undefined;
  GameplayService.dispose();
  socket?.off("setData", onReady);
  socket?.off("ready", onReady);
  socket?.off("end", onEnd);
  socket?.off("resultStatus", onResultStatus);
  socket?.off("sessionStatus", onSessionStatus);
  socket?.off("finish", onFinish);
  socket?.off("roomlist", onRooms);
  socket?.off("error", onError);
  socket?.off("exception", onError);
  socket?.off("connect_error", onError);
  socket?.off("connect", onConnect);
  socket?.off("disconnect", onDisconnect);
  socket?.emit("end");
  socket?.close();
  if (store.getters.gameSocket === socket) store.commit("setGameSocket", null);
  clearDisplay();
  store.commit("setOnlineState", null);
  store.commit("setIsSearching", false);
});
</script>
