<template>
  <main
    class="arcade-page match-page online-game"
    :data-phase="match?.phase || 'lobby'"
    @pointerdown.capture="activateSound"
    @keydown.capture="activateSoundFromKey"
  >
    <nav class="arcade-nav" aria-label="Online match navigation">
      <span class="arcade-brand"
        ><span class="brand-mark">Ⅱ</span> ONLINE
        <span class="brand-sub">/ {{ title }}</span></span
      >
      <div class="match-tools">
        <button class="quiet-button" type="button" data-testid="online-sound"
          :aria-pressed="audioStatus === 'ready' && !soundMuted" @click="toggleSound">
          {{ audioStatus === 'ready' && !soundMuted ? '소리 켬' : soundMuted ? '소리 끔' : '소리 활성화' }}
        </button>
        <router-link to="/" class="quiet-link" data-testid="online-menu"
          >홈으로</router-link
        ><router-link to="/play" class="quiet-link">로컬 · AI</router-link>
      </div>
    </nav>
    <p class="power-note" role="status" data-testid="online-audio-status" :data-audio-status="audioStatus">{{ audioNotice }}</p>
    <section v-if="!recoveredResult" class="scoreboard" aria-label="경기 점수">
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
            ? 'Pong 관전 화면. 관전 중에는 패들을 조작할 수 없습니다.'
            : '온라인 Pong. 클릭 후 키보드로 조작합니다.'
        "
        data-testid="online-court"
        @click="focusCourt"
      ></canvas>
      <div v-if="result" class="court-overlay" data-testid="online-result">
        <div class="overlay-panel">
          <p class="eyebrow">MATCH COMPLETE</p>
          <h1>{{ result }}</h1>
          <p v-if="!recoveredResult">
            {{ store.getters.gameData.score.left }} :
            {{ store.getters.gameData.score.right }}
          </p>
          <p v-else data-testid="recovered-score">승자 {{ recoveredResult.winnerName }} {{ recoveredResult.winnerScore }}점 · 패자 {{ recoveredResult.loserName }} {{ recoveredResult.loserScore }}점</p>
          <p>{{ status }}</p>
          <slot name="result-actions" /><router-link to="/" class="quiet-link"
            >홈으로</router-link
          >
        </div>
      </div>
      <div v-else-if="match?.phase === 'finished'" class="court-overlay">
        <div class="overlay-panel">
          <p class="eyebrow">MATCH FINISHED</p>
          <h1>경기 종료</h1>
          <p>{{ status }}</p>
          <router-link to="/" class="quiet-link">홈으로</router-link>
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
      <label>모션<select :value="settings.motion" @change="changeMotion" data-testid="online-motion">
        <option value="system">시스템 설정</option><option value="reduce">줄이기</option>
      </select></label>
      <slot name="actions" />
    </section>
    <p v-if="!spectator" class="power-note" data-testid="online-key-hint">
      위로 {{ keyLabel(keys.up) }} · 아래로 {{ keyLabel(keys.down) }} · Power {{ keyLabel(keys.action) }}
    </p>
    <p class="power-note">
      {{
        spectator
          ? "진행 중인 경기를 실시간으로 볼 수 있습니다. 관전 중에는 패들을 조작할 수 없습니다."
          : "경기장을 클릭한 뒤 키보드로 조작하세요. 채팅을 입력하거나 설정을 바꿀 때는 패들이 움직이지 않습니다."
      }}
    </p>
    <p v-if="mode && !spectator" class="power-note">
      공을 패들(공을 받아치는 막대)로 다섯 번 받아치면 Power가 충전됩니다. Power 키를 누르면 패들이 길어집니다. 길어진 상태에서 공을 받아칠 때마다 충전량이 한 칸씩 줄어들고, 모두 소모하면 원래 길이로 돌아옵니다. 이동하면서 사용할 수 있습니다.
    </p>
    <details class="online-diagnostics">
      <summary>연결 상태 자세히 보기</summary>
      <div class="debug-panel">
        <span
          >화면 갱신 빈도(FPS) <b>{{ onlineMetrics.fps.toFixed(1) }}</b></span
        ><span
          >받은 경기 상태 수 <b>{{ onlineMetrics.snapshots }}</b></span
        ><span
          >보낸 입력 수 <b>{{ onlineMetrics.inputMessages }}</b></span
        ><span
          >서버 응답 왕복 시간(RTT)
          <b>{{
            onlineMetrics.transportRoundTripMs === null
              ? "대기"
              : onlineMetrics.transportRoundTripMs.toFixed(1) + " ms"
          }}</b></span
        ><span
          >입력 반영 확인 시간
          <b>{{
            onlineMetrics.ackRoundTripMs === null
              ? "대기"
              : onlineMetrics.ackRoundTripMs.toFixed(1) + " ms"
          }}</b></span
        ><span
          >보관 중인 경기 상태 수 <b>{{ onlineMetrics.bufferDepth }}</b></span
        ><span
          >추정 표시 지연
          <b>{{ onlineMetrics.displayDelayMs.toFixed(1) }} ms</b></span
        ><span
          >보간할 다음 상태가 없었던 횟수 <b>{{ onlineMetrics.underflows }}</b></span
        ><span>서버 이벤트 <b>{{ onlineMetrics.serverEventsReceived || 0 }}</b></span
        ><span>표시 시점 이벤트 <b>{{ onlineMetrics.effectsPresented || 0 }}</b></span
        ><span>건너뛴 효과 <b>{{ onlineMetrics.effectsSkipped || 0 }}</b></span
        ><small
          >서버 응답 왕복 시간은 요청을 보내고 답을 받기까지 걸린 시간이며, 서버 처리와 브라우저 대기를 포함합니다. 입력 반영 확인 시간은 서버가 입력을 적용한 경기 상태를 받을 때까지의 시간입니다. 모니터에 화면이 나타날 때까지의 시간을 뜻하지 않습니다. 추정 표시 지연은 현재 추정한 서버 시각과 화면에 표시하는 경기 상태 사이의 차이입니다. 다음 상태가 없었던 횟수는 상태가 부족해지기 시작한 구간을 세며, 매 프레임을 세지 않습니다.</small
        >
      </div>
    </details>
  </main>
</template>

<script setup lang="ts">
/* global defineProps, defineEmits */
import { computed, onMounted, onUnmounted, reactive, ref, watch } from "vue";
import { createGame, GameState, Side } from "../../../../shared/game-core";
import type { RecoveredResult } from "../../../../shared/protocol";
import { CourtRenderer } from "@/arcade/court-renderer";
import { AudioFeedback, AudioStatus } from "@/arcade/audio-feedback";
import { readPreferences, savePreferences } from "@/arcade/preferences";
import { onlineBindings, readOnlinePreferences, saveOnlinePreferences } from "@/arcade/online-preferences";
import { keyLabel } from "@/arcade/keyboard-controller";
import { GameplayService } from "@/plugins/gamePlayService";
import store from "@/store";
import "@/arcade/arcade.css";

const props = defineProps<{
  title: string;
  status: string;
  active: boolean;
  waiting: boolean;
  result: string;
  recoveredResult?: RecoveredResult | null;
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
const settings = reactive(readOnlinePreferences());
const keys = computed(() => onlineBindings(props.layout));
const soundMuted = ref(readPreferences().muted);
const audioStatus = ref<AudioStatus>('muted');
const audio = new AudioFeedback(status => { audioStatus.value = status; });
audio.restoreMuted(soundMuted.value);
const audioNotice = computed(() => ({
  muted: '소리가 꺼져 있습니다.', ready: '소리 켜짐 · 서버의 실제 타격·득점에 맞춰 재생합니다.',
  'gesture-required': '저장된 소리 설정을 켜려면 소리 버튼이나 경기 시작을 눌러 주세요.',
  starting: '브라우저에서 소리를 준비하고 있습니다.',
  blocked: '브라우저가 소리 재생을 허용하지 않았습니다. 소리 활성화를 다시 눌러 주세요.',
  unavailable: '이 브라우저에서 소리를 시작하지 못했습니다. 경기 화면은 계속 사용할 수 있습니다.',
}[audioStatus.value]));
let preview: CourtRenderer | undefined;
let motion: MediaQueryList | undefined;
let detachFeedback: (() => void) | undefined;
function activateSound(event: Event) {
  // The explicit sound button owns its toggle; activation before click would
  // turn a restored "activate" action straight back into mute.
  if ((event.target as Element | null)?.closest?.('[data-testid="online-sound"], input, select, textarea, a')) return;
  if (event.isTrusted && !soundMuted.value && audio.status !== 'ready') audio.setMuted(false);
}
function activateSoundFromKey(event: KeyboardEvent) {
  if (event.code === 'Enter' || event.code === 'Space') activateSound(event);
}
function toggleSound() {
  soundMuted.value = !soundMuted.value && ['ready', 'starting'].includes(audio.status);
  audio.setMuted(soundMuted.value);
  savePreferences({ ...readPreferences(), muted: soundMuted.value });
}
function applyMotion() {
  const reduced = settings.motion === 'reduce';
  preview?.setReducedMotion(reduced || Boolean(motion?.matches));
  if (canvas.value) GameplayService.useReducedMotion(canvas.value, reduced);
  drawPreview();
}
function changeMotion(event: Event) {
  settings.motion = (event.target as HTMLSelectElement).value === 'reduce' ? 'reduce' : 'system';
  saveOnlinePreferences(settings); applyMotion();
}
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
  settings.layout = (event.target as HTMLSelectElement).value === 'wasd' ? 'wasd' : 'arrows';
  saveOnlinePreferences(settings);
  emit(
    "update:layout",
    settings.layout
  );
}
watch(() => [props.mode, props.map, props.active, props.result], drawPreview);
watch(
  () => props.map,
  () => {
    if (!canvas.value) return;
    preview = new CourtRenderer(
      canvas.value,
      Boolean(motion?.matches) || settings.motion === 'reduce',
      props.map
    );
    drawPreview();
  }
);
onMounted(() => {
  const context = canvas.value?.getContext("2d");
  if (!context || !canvas.value) return;
  motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  detachFeedback = GameplayService.bindFeedback(canvas.value, { audio, reducedMotion: settings.motion === 'reduce' });
  GameplayService.useKeyLayout(settings.layout);
  emit('update:layout', settings.layout);
  preview = new CourtRenderer(
    canvas.value,
    motion.matches || settings.motion === 'reduce',
    props.map
  );
  drawPreview();
  emit("context-ready", context);
  window.addEventListener("resize", drawPreview);
  motion.addEventListener('change', applyMotion);
});
onUnmounted(() => {
  window.removeEventListener('resize', drawPreview);
  motion?.removeEventListener('change', applyMotion);
  detachFeedback?.(); audio.dispose();
});
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
