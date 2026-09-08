<template>
  <main
    class="arcade-page match-page online-game"
    :data-phase="match?.phase || 'lobby'"
  >
    <nav class="arcade-nav" aria-label="Online match navigation">
      <span class="arcade-brand"
        ><span class="brand-mark">Ⅱ</span> ONLINE
        <span class="brand-sub">/ {{ title }}</span></span
      >
      <div class="match-tools">
        <router-link to="/" class="quiet-link" data-testid="online-menu"
          >서비스 메뉴</router-link
        ><router-link to="/play" class="quiet-link">로컬 · AI</router-link>
      </div>
    </nav>
    <section class="scoreboard" aria-label="경기 점수">
      <div class="player-label player-left">
        <span class="player-avatar">P1</span>
        <div>
          <p>{{ store.getters.room.leftName || "PLAYER 1" }}</p>
          <small>{{
            match?.config.mode.toUpperCase() || (mode ? "POWER" : "CLASSIC")
          }}</small>
        </div>
      </div>
      <div class="match-score">
        <strong data-testid="online-score-left">{{
          store.getters.gameData.score.left
        }}</strong>
        <div>
          <span>{{ spectator ? "SPECTATING" : "ONLINE" }}</span
          ><small>FIRST TO 6</small>
        </div>
        <strong data-testid="online-score-right">{{
          store.getters.gameData.score.right
        }}</strong>
      </div>
      <div class="player-label player-right">
        <div>
          <p>{{ store.getters.room.rightName || "PLAYER 2" }}</p>
          <small>{{ spectator ? "PLAYER 2" : "ONLINE OPPONENT" }}</small>
        </div>
        <span class="player-avatar">P2</span>
      </div>
    </section>
    <section class="court-shell">
      <canvas
        ref="canvas"
        class="arcade-canvas"
        tabindex="0"
        role="application"
        :aria-label="
          spectator
            ? 'Pong 관전 화면. 플레이어 입력은 보내지 않습니다.'
            : '온라인 Pong. 클릭 후 키보드로 조작합니다.'
        "
        data-testid="online-court"
        @click="focusCourt"
      ></canvas>
      <div v-if="result" class="court-overlay" data-testid="online-result">
        <div class="overlay-panel">
          <p class="eyebrow">MATCH COMPLETE</p>
          <h1>{{ result }}</h1>
          <p>
            {{ store.getters.gameData.score.left }} :
            {{ store.getters.gameData.score.right }}
          </p>
          <p>{{ status }}</p>
          <slot name="result-actions" /><router-link to="/" class="quiet-link"
            >메뉴로 돌아가기</router-link
          >
        </div>
      </div>
      <div v-else-if="match?.phase === 'finished'" class="court-overlay">
        <div class="overlay-panel">
          <p class="eyebrow">MATCH FINISHED</p>
          <h1>경기 종료</h1>
          <p>{{ status }}</p>
          <router-link to="/" class="quiet-link">서비스 메뉴</router-link>
        </div>
      </div>
      <div v-else-if="!active" class="court-overlay">
        <div class="overlay-panel">
          <p class="eyebrow">
            {{ spectator ? "WATCH THE RALLY" : "PLAY TOGETHER" }}
          </p>
          <h1>{{ waiting ? "상대를 기다립니다" : title }}</h1>
          <p>{{ status }}</p>
          <slot name="start-action" />
        </div>
      </div>
      <div v-else-if="match?.phase === 'ready'" class="countdown-overlay">
        <span>GET READY</span
        ><strong>{{ Math.max(1, Math.ceil(match.phaseTicks / 60)) }}</strong>
      </div>
      <div
        v-else-if="match?.phase === 'point'"
        class="point-feedback"
        role="status"
      >
        득점! <span>다음 서브 준비</span>
      </div>
    </section>
    <p class="online-status" role="status" data-testid="online-status">
      {{ status }}
    </p>
    <div v-if="match?.config.mode === 'power'" class="court-footer">
      <div
        v-for="side in sides"
        :key="side"
        class="power-meter"
        :class="{ 'right-meter': side === 'right' }"
      >
        <span
          >{{ side === "left" ? "P1" : "P2" }}
          {{ match.players[side].powered ? "POWER ACTIVE" : "CHARGE" }}</span
        ><i
          v-for="n in 5"
          :key="n"
          :class="{ filled: match.players[side].charge >= n }"
        ></i
        ><b>{{ match.players[side].charge }}/5</b>
      </div>
    </div>
    <section class="online-controls" aria-label="온라인 게임 설정">
      <label v-if="!spectator"
        >규칙<select
          :value="mode ? 'power' : 'classic'"
          :disabled="active || waiting"
          @change="changeMode"
        >
          <option value="classic">Classic</option>
          <option value="power">Power</option>
        </select></label
      >
      <label
        >코트<select
          :value="map"
          :disabled="active || waiting"
          @change="changeMap"
        >
          <option value="winter">Winter</option>
          <option value="black">Night</option>
          <option value="space">Space</option>
        </select></label
      >
      <label v-if="!spectator"
        >조작<select
          :value="layout"
          @change="changeLayout"
          data-testid="online-key-layout"
        >
          <option value="arrows">↑ / ↓ · Space</option>
          <option value="wasd">W / S · D</option>
        </select></label
      >
      <slot name="actions" />
    </section>
    <p class="power-note">
      {{
        spectator
          ? "관전은 서버가 보낸 같은 경기 상태를 표시하며 조작 입력을 보내지 않습니다."
          : "경기장을 클릭하면 키보드 입력이 활성화됩니다. 채팅·설정 입력 중에는 게임 키를 가로채지 않습니다."
      }}
    </p>
    <p v-if="mode && !spectator" class="power-note">
      유효 반사 5회 충전 → 능력 키로 확장 → 강화 반사마다 1칸 소모. 이동하면서
      발동할 수 있습니다.
    </p>
    <details class="online-diagnostics">
      <summary>실제 연결 진단값</summary>
      <div class="debug-panel">
        <span
          >RAF FPS <b>{{ onlineMetrics.fps.toFixed(1) }}</b></span
        ><span
          >snapshots <b>{{ onlineMetrics.snapshots }}</b></span
        ><span
          >input messages <b>{{ onlineMetrics.inputMessages }}</b></span
        ><span
          >전송 RTT
          <b>{{
            onlineMetrics.transportRoundTripMs === null
              ? "대기"
              : onlineMetrics.transportRoundTripMs.toFixed(1) + " ms"
          }}</b></span
        ><span
          >ACK 관측 왕복
          <b>{{
            onlineMetrics.ackRoundTripMs === null
              ? "대기"
              : onlineMetrics.ackRoundTripMs.toFixed(1) + " ms"
          }}</b></span
        ><span
          >buffer <b>{{ onlineMetrics.bufferDepth }}</b></span
        ><span
          >표시 지연
          <b>{{ onlineMetrics.displayDelayMs.toFixed(1) }} ms</b></span
        ><span
          >buffer 고갈 <b>{{ onlineMetrics.underflows }}</b></span
        ><small
          >전송 RTT는 별도 응답의 왕복 시간이며 서버 처리·브라우저 대기를
          포함합니다. ACK 관측값에는 서버 입력 적용 및 snapshot 수신까지가
          포함됩니다. 두 값 모두 광학 입력 지연 측정은 아닙니다.</small
        >
      </div>
    </details>
  </main>
</template>

<script setup lang="ts">
/* global defineProps, defineEmits */
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { createGame, GameState, Side } from "../../../../shared/game-core";
import { CourtRenderer } from "@/arcade/court-renderer";
import store from "@/store";
import "@/arcade/arcade.css";

const props = defineProps<{
  title: string;
  status: string;
  active: boolean;
  waiting: boolean;
  result: string;
  mode: boolean;
  map: string;
  layout: "arrows" | "wasd";
  spectator?: boolean;
}>();
const emit = defineEmits<{
  (event: "context-ready", context: CanvasRenderingContext2D): void;
  (event: "update:mode", mode: boolean): void;
  (event: "update:map", map: string): void;
  (event: "update:layout", layout: "arrows" | "wasd"): void;
}>();
const canvas = ref<HTMLCanvasElement | null>(null);
const match = computed<GameState | null>(() => store.getters.onlineState);
const onlineMetrics = computed(() => store.getters.onlineMetrics);
const sides: Side[] = ["left", "right"];
let preview: CourtRenderer | undefined;
function focusCourt() {
  if (!props.spectator) canvas.value?.focus({ preventScroll: true });
}
function drawPreview() {
  if (!props.active && !props.result)
    preview?.draw(createGame({ mode: props.mode ? "power" : "classic" }));
}
function changeMode(event: Event) {
  emit("update:mode", (event.target as HTMLSelectElement).value === "power");
}
function changeMap(event: Event) {
  emit("update:map", (event.target as HTMLSelectElement).value);
}
function changeLayout(event: Event) {
  emit(
    "update:layout",
    (event.target as HTMLSelectElement).value === "wasd" ? "wasd" : "arrows"
  );
}
watch(() => [props.mode, props.map, props.active, props.result], drawPreview);
watch(
  () => props.map,
  () => {
    if (!canvas.value) return;
    preview = new CourtRenderer(
      canvas.value,
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      props.map
    );
    drawPreview();
  }
);
onMounted(() => {
  const context = canvas.value?.getContext("2d");
  if (!context || !canvas.value) return;
  preview = new CourtRenderer(
    canvas.value,
    window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    props.map
  );
  drawPreview();
  emit("context-ready", context);
  window.addEventListener("resize", drawPreview);
});
onUnmounted(() => window.removeEventListener("resize", drawPreview));
</script>

<style scoped>
.online-game {
  width: 100%;
  min-width: 0;
}
.online-game .overlay-panel h1,
.online-game .overlay-panel p {
  word-break: keep-all;
  overflow-wrap: anywhere;
}
.online-status {
  max-width: 1200px;
  text-align: center;
  color: #bcc9df;
  font-size: 12px;
  line-height: 1.7;
  margin: 14px auto;
}
.online-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: center;
  gap: 15px;
  margin: 19px auto 10px;
  max-width: 1200px;
}
.online-controls label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 10px;
  color: #9ca9c0;
}
.online-controls select {
  font-size: 12px;
  min-width: 112px;
}
.online-diagnostics {
  max-width: 1200px;
  margin: 16px auto;
  color: #9ca9c0;
  font-size: 11px;
}
.online-diagnostics summary {
  cursor: pointer;
}
.online-diagnostics .debug-panel {
  margin-top: 10px;
}
.online-game .court-shell {
  width: min(100%, max(440px, calc((100svh - 350px) * 1.5)));
}
@media (max-width: 740px) {
  .online-game .court-shell {
    width: 100%;
  }
  .online-game .brand-sub {
    display: inline;
    font-size: 8px;
    letter-spacing: 0;
  }
  .online-game .arcade-nav {
    gap: 8px;
  }
  .online-game .quiet-link {
    font-size: 10px;
  }
}
</style>
