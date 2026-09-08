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
          >서비스 메뉴</router-link
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
          <p v-if="!recoveredResult">
            {{ store.getters.gameData.score.left }} :
            {{ store.getters.gameData.score.right }}
          </p>
          <p v-else data-testid="recovered-score">승자 {{ recoveredResult.winnerName }} {{ recoveredResult.winnerScore }}점 · 패자 {{ recoveredResult.loserName }} {{ recoveredResult.loserScore }}점</p>
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
      <label>모션<select :value="settings.motion" @change="changeMotion" data-testid="online-motion">
        <option value="system">시스템 설정</option><option value="reduce">줄이기</option>
      </select></label>
      <slot name="actions" />
    </section>
    <p v-if="!spectator" class="power-note" data-testid="online-key-hint">
      이동 {{ keyLabel(keys.up) }} / {{ keyLabel(keys.down) }} · Power 모드 {{ keyLabel(keys.action) }}
    </p>
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
        ><span>서버 이벤트 <b>{{ onlineMetrics.serverEventsReceived || 0 }}</b></span
        ><span>표시 시점 이벤트 <b>{{ onlineMetrics.effectsPresented || 0 }}</b></span
        ><span>건너뛴 효과 <b>{{ onlineMetrics.effectsSkipped || 0 }}</b></span
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
