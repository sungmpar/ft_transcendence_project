<template>
  <InviteSlider />
  <OnlineGameShell
    title="친구 초대"
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
        v-if="store.getters.inviteFriendName"
        class="arcade-button primary mint-button"
        :disabled="waiting || !connected"
        @click="inviteGame"
        data-testid="online-play"
      >
        {{ store.getters.inviteFriendName }} 초대하기</button
      ><button
        v-else
        class="arcade-button primary mint-button"
        :disabled="!connected"
        @click="findInviteList"
        data-testid="online-play"
      >
        받은 초대 확인
      </button></template
    >
    <template #actions
      ><button
        class="arcade-button"
        :disabled="active || !connected"
        @click="findInviteList"
      >
        받은 초대</button
      ><button
        v-if="store.getters.inviteFriendName"
        class="arcade-button"
        :disabled="active || waiting || !connected"
        @click="inviteGame"
      >
        친구 초대</button
      ><button v-if="waiting" class="quiet-button" @click="cancelWaiting">
        초대 취소
      </button></template
    >
    <template #result-actions
      ><button
        class="arcade-button primary mint-button"
        :disabled="!connected"
        @click="
          store.getters.inviteFriendName ? inviteGame() : findInviteList()
        "
        data-testid="online-rematch"
      >
        {{ store.getters.inviteFriendName ? "다시 초대" : "초대 목록" }} ↻
      </button></template
    >
  </OnlineGameShell>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import type { Socket } from "socket.io-client";
import { isReadyMessage, ReadyMessage } from "../../../shared/protocol";
import { GameplayService } from "@/plugins/gamePlayService";
import OnlineGameShell from "@/components/game/OnlineGameShell.vue";
import InviteSlider from "@/components/game/InviteSlider.vue";
import store from "@/store";
import { OnlineResultNotice } from "@/arcade/online-result";

const route = useRoute();
const socket = store.getters.gameSocket as Socket | null;
const active = ref(false),
  waiting = ref(false),
  connected = ref(socket?.connected || false);
const result = ref(""),
  status = ref("친구를 초대하거나 받은 초대를 선택하세요.");
const mode = ref(true),
  map = ref("black"),
  layout = ref<"arrows" | "wasd">("arrows");
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
  store.commit("setIsSearching", true);
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
function onRefuse() {
  if (disposed) return;
  waiting.value = false;
  status.value = "친구가 초대를 거절했습니다.";
}
function onInvite() {
  if (disposed) return;
  status.value = "초대를 보냈습니다. 친구의 응답을 기다립니다.";
}
function onInviteList(value: unknown) {
  if (disposed) return;
  if (
    value &&
    typeof value === "object" &&
    "userInviteList" in value &&
    Array.isArray(value.userInviteList)
  )
    store.commit("setUserInviteList", value);
}
function onError(value: unknown) {
  if (disposed) return;
  status.value =
    value &&
    typeof value === "object" &&
    "message" in value &&
    typeof value.message === "string"
      ? value.message
      : "초대 요청을 처리하지 못했습니다.";
  waiting.value = false;
}
function onConnect() {
  if (disposed) return;
  connected.value = true;
  status.value = active.value
    ? "다시 연결됐습니다. 경기 상태를 확인합니다."
    : "친구를 초대하거나 받은 초대를 선택하세요.";
}
function onDisconnect() {
  if (disposed) return;
  connected.value = false;
  waiting.value = false;
  status.value = "연결이 끊겼습니다. 재연결을 기다립니다.";
}
function findInviteList() {
  if (!socket?.connected || active.value) return;
  socket.emit("invitelist");
  store.commit("setIsSearching", false);
}
function inviteGame() {
  if (!socket?.connected || active.value || waiting.value) return;
  const friendId = Number(store.getters.inviteFriendId);
  if (!Number.isSafeInteger(friendId) || friendId < 1) {
    status.value = "친구 목록에서 초대할 사람을 선택해 주세요.";
    return;
  }
  GameplayService.dispose();
  store.commit("setOnlineState", null);
  clearDisplay();
  result.value = "";
  waiting.value = true;
  status.value = "친구에게 초대를 보내고 있습니다.";
  socket.emit("invite", {
    id: store.getters.userid,
    friendId,
    mode: mode.value,
  });
}
function cancelWaiting() {
  socket?.emit("end");
  waiting.value = false;
  status.value = "초대를 취소했습니다.";
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
socket?.on("refuse", onRefuse);
socket?.on("invite", onInvite);
socket?.on("userInviteList", onInviteList);
socket?.on("error", onError);
socket?.on("exception", onError);
socket?.on("connect_error", onError);
socket?.on("connect", onConnect);
socket?.on("disconnect", onDisconnect);
clearDisplay();
store.commit("setOnlineState", null);
onMounted(() => {
  if (route.params.friendId)
    store.commit("setInviteFriendId", route.params.friendId);
  if (route.params.friendName)
    store.commit("setInviteFriendName", route.params.friendName);
  store.commit("setIsSearching", true);
});
onUnmounted(() => {
  disposed = true;
  pendingReady = undefined;
  GameplayService.dispose();
  socket?.off("ready", onReady);
  socket?.off("end", onEnd);
  socket?.off("resultStatus", onResultStatus);
  socket?.off("sessionStatus", onSessionStatus);
  socket?.off("refuse", onRefuse);
  socket?.off("invite", onInvite);
  socket?.off("userInviteList", onInviteList);
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
  store.commit("setInviteFriendId", 0);
  store.commit("setInviteFriendName", "");
});
</script>
