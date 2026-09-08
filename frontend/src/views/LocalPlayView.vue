<template>
  <main
    class="arcade-page match-page"
    data-testid="local-play"
    :data-mode="isAi ? 'ai' : 'local'"
    :data-phase="state.phase"
    :data-paused="paused"
  >
    <nav class="arcade-nav" aria-label="Match navigation">
      <router-link to="/play" class="arcade-brand" data-testid="menu-link"
        ><span class="brand-mark">Ⅱ</span> ARCADE
        <span class="brand-sub"
          >/ {{ isAi ? "AI MATCH" : "LOCAL DUEL" }}</span
        ></router-link
      >
      <div class="match-tools">
        <button
          class="quiet-button"
          @click="toggleSound"
          :aria-pressed="!preferences.muted"
          data-testid="toggle-sound"
        >
          {{ preferences.muted ? "소리 끔" : "소리 켬" }}
        </button>
        <button
          class="quiet-button"
          @click="openSettings"
          :aria-expanded="settingsOpen"
          data-testid="key-settings"
        >
          키 설정
        </button>
        <button
          class="quiet-button"
          @click="showDebug = !showDebug"
          :aria-pressed="showDebug"
          data-testid="toggle-debug"
        >
          분석
        </button>
        <button
          v-if="started && state.phase !== 'finished'"
          class="arcade-button compact"
          @click="paused ? resume() : pause('직접 멈췄습니다.')"
          data-testid="pause-match"
        >
          {{ paused ? "계속하기" : "일시 정지" }}
        </button>
      </div>
    </nav>

    <section class="scoreboard" aria-label="현재 점수">
      <div class="player-label player-left">
        <span class="player-avatar">P1</span>
        <div>
          <p>{{ leftName }}</p>
          <small
            >{{ leftKeys.up }} / {{ leftKeys.down
            }}<template v-if="preferences.rule === 'power'">
              · {{ leftKeys.action }} POWER</template
            ></small
          >
        </div>
      </div>
      <div class="match-score">
        <strong data-testid="score-left">{{ state.players.left.score }}</strong>
        <div>
          <span>{{ preferences.rule.toUpperCase() }}</span
          ><small>FIRST TO 6</small>
        </div>
        <strong data-testid="score-right">{{
          state.players.right.score
        }}</strong>
      </div>
      <div class="player-label player-right">
        <div>
          <p>{{ rightName }}</p>
          <small>{{
            isAi
              ? preferences.difficulty.toUpperCase() + " · RULE BASED"
              : rightKeys.up +
                " / " +
                rightKeys.down +
                (preferences.rule === "power"
                  ? " · " + rightKeys.action + " POWER"
                  : "")
          }}</small>
        </div>
        <span class="player-avatar">{{ isAi ? "AI" : "P2" }}</span>
      </div>
    </section>

    <section class="court-shell" aria-label="Pong court">
      <canvas
        ref="canvas"
        class="arcade-canvas"
        tabindex="0"
        role="application"
        aria-label="Pong 경기장. 조작하려면 경기장을 클릭하세요. Escape로 일시 정지."
        aria-describedby="match-instructions"
        data-testid="court"
        @click="focusCourt"
      ></canvas>
      <div v-if="errorMessage" class="court-overlay">
        <div class="overlay-panel">
          <p class="eyebrow">MATCH ERROR</p>
          <h1>경기를 멈췄습니다.</h1>
          <p role="alert">{{ errorMessage }}</p>
          <router-link to="/play" class="arcade-button primary"
            >모드 선택으로</router-link
          >
        </div>
      </div>
      <div v-else-if="!started" class="court-overlay">
        <div class="overlay-panel">
          <p class="eyebrow">
            {{ isAi ? "MEET YOUR OPPONENT" : "GRAB A FRIEND" }}
          </p>
          <h1>{{ isAi ? "준비됐나요?" : "두 사람, 한 키보드." }}</h1>
          <p>
            패들을 움직여 공을 받아치세요.<br />상대 골에 공을 넣으면 1점. 먼저
            6점을 얻으면 승리!
          </p>
          <button
            class="arcade-button primary mint-button"
            @click="startMatch"
            data-testid="start-match"
          >
            경기 시작 <span>→</span></button
          ><small>경기장을 클릭하면 키보드 조작이 활성화됩니다.</small>
        </div>
      </div>
      <div
        v-else-if="state.phase === 'finished'"
        class="court-overlay"
        data-testid="match-finished"
      >
        <div class="overlay-panel">
          <p class="eyebrow">MATCH COMPLETE</p>
          <h1>{{ state.winner === "left" ? leftName : rightName }} 승리!</h1>
          <p class="result-score">
            {{ state.players.left.score }} <span>:</span>
            {{ state.players.right.score }}
          </p>
          <p>좋은 경기였습니다. 한 판 더?</p>
          <button
            class="arcade-button primary mint-button"
            @click="restartMatch"
            data-testid="restart-match"
          >
            다시 대결 <span>↻</span></button
          ><router-link to="/play" class="quiet-link"
            >모드 선택으로 돌아가기</router-link
          >
        </div>
      </div>
      <div v-else-if="paused" class="court-overlay" data-testid="pause-overlay">
        <div class="overlay-panel">
          <p class="eyebrow">TAKE A BREATHER</p>
          <h1>일시 정지</h1>
          <p>{{ pauseReason }}<br />준비되면 직접 계속하기를 눌러 주세요.</p>
          <button
            class="arcade-button primary mint-button"
            @click="resume"
            data-testid="resume-match"
          >
            계속하기 <span>→</span>
          </button>
        </div>
      </div>
      <div
        v-else-if="state.phase === 'ready'"
        class="countdown-overlay"
        aria-live="polite"
        data-testid="countdown"
      >
        <span>GET READY</span
        ><strong>{{ Math.max(1, Math.ceil(state.phaseTicks / 60)) }}</strong>
      </div>
      <div
        v-else-if="state.phase === 'point'"
        class="point-feedback"
        role="status"
        data-testid="point-feedback"
      >
        {{ lastScorer === "left" ? leftName : rightName }} +1
        <span>다음 서브</span>
      </div>
      <span class="court-corner top-left" aria-hidden="true"></span
      ><span class="court-corner bottom-right" aria-hidden="true"></span>
    </section>

    <section class="court-footer" id="match-instructions">
      <div
        class="power-meter"
        v-if="preferences.rule === 'power'"
        aria-label="P1 Power 충전"
      >
        <span>{{
          state.players.left.powered ? "POWER ACTIVE" : "P1 CHARGE"
        }}</span
        ><i
          v-for="n in 5"
          :key="n"
          :class="{ filled: state.players.left.charge >= n }"
        ></i
        ><b>{{ state.players.left.charge }}/5</b>
      </div>
      <span v-else class="instruction-key"
        ><kbd>{{ leftKeys.up }}</kbd
        ><kbd>{{ leftKeys.down }}</kbd> {{ leftName }} 이동</span
      >
      <p class="match-status" role="status">
        {{ statusLabel }} <span>·</span> <kbd>Esc</kbd> 일시 정지
      </p>
      <div
        class="power-meter right-meter"
        v-if="preferences.rule === 'power'"
        aria-label="P2 Power 충전"
      >
        <span>{{
          state.players.right.powered ? "POWER ACTIVE" : "P2 CHARGE"
        }}</span
        ><i
          v-for="n in 5"
          :key="n"
          :class="{ filled: state.players.right.charge >= n }"
        ></i
        ><b>{{ state.players.right.charge }}/5</b>
      </div>
      <span v-else class="instruction-key"
        >{{ isAi ? "컴퓨터가 P2를 조작합니다" : "P2 이동" }}
        <template v-if="!isAi"
          ><kbd>{{ rightKeys.up }}</kbd
          ><kbd>{{ rightKeys.down }}</kbd></template
        ></span
      >
    </section>
    <p class="power-note" v-if="preferences.rule === 'power'">
      유효 반사 5회로 충전 → 능력 키로 확장 → 강화 중 반사마다 1칸 소모 →
      0칸이면 해제. 이동 중에도 발동할 수 있습니다.
    </p>

    <section
      v-if="settingsOpen"
      class="settings-panel"
      aria-labelledby="settings-title"
      data-testid="settings-panel"
    >
      <div>
        <p class="eyebrow">MAKE IT YOURS</p>
        <h2 id="settings-title">키보드 설정</h2>
        <p>
          중복되지 않는 여섯 키를 선택하세요. 물리 키보드의 동시 입력 한계는
          모델마다 다릅니다.
        </p>
      </div>
      <div class="mapping-grid">
        <fieldset v-for="side in sides" :key="side">
          <legend>
            {{ side === "left" ? "WASD 쪽 키 구성" : "화살표 쪽 키 구성" }}
          </legend>
          <label v-for="action in actions" :key="action.value"
            >{{ action.label
            }}<select
              v-model="draftBindings[side][action.value]"
              :data-testid="`binding-${side}-${action.value}`"
            >
              <option v-for="code in KEY_OPTIONS" :key="code" :value="code">
                {{ keyLabel(code) }}
              </option>
            </select></label
          >
        </fieldset>
      </div>
      <label v-if="isAi" class="human-key-choice"
        >사람이 사용할 키 구성
        <select v-model="draftHumanKeys" data-testid="human-keys">
          <option value="left">WASD 쪽 (왼쪽 패들)</option>
          <option value="right">화살표 쪽 (왼쪽 패들)</option>
        </select></label
      >
      <p
        v-if="mappingError"
        role="alert"
        class="mapping-error"
        data-testid="binding-error"
      >
        {{ mappingError }}
      </p>
      <div class="settings-actions">
        <button class="quiet-button" @click="resetBindings">기본 키로</button
        ><button
          class="arcade-button"
          :disabled="!!mappingError"
          @click="applyBindings"
          data-testid="apply-bindings"
        >
          설정 적용
        </button>
      </div>
    </section>

    <section
      v-if="showDebug"
      class="debug-panel"
      data-testid="debug-hud"
      aria-label="실제 경기 진단값"
    >
      <span
        >tick <b>{{ state.tick }}</b></span
      ><span
        >RAF FPS <b>{{ metrics.fps.toFixed(1) }}</b></span
      ><span
        >steps/frame <b>{{ metrics.lastSteps }}</b></span
      ><span
        >dropped time <b>{{ metrics.droppedMs.toFixed(1) }} ms</b></span
      ><span
        >step CPU total <b>{{ metrics.simulationMs.toFixed(2) }} ms</b></span
      ><span
        >seed <b>{{ seed }}</b></span
      >
      <template v-if="aiDebug"
        ><span
          >관측 tick <b>{{ aiDebug.observationTick ?? "대기" }}</b></span
        ><span
          >판단 tick <b>{{ aiDebug.decisionTick ?? "대기" }}</b></span
        ><span
          >예상 y <b>{{ aiDebug.predictedY?.toFixed(1) ?? "없음" }}</b></span
        ><span
          >목표 y <b>{{ aiDebug.targetY?.toFixed(1) ?? "없음" }}</b></span
        ><span
          >반응/관측/판단
          <b
            >{{ aiDebug.reactionTicks }}/{{ aiDebug.observationEveryTicks }}/{{
              aiDebug.decisionEveryTicks
            }}
            ticks</b
          ></span
        ><span
          >AI 입력
          <b
            >{{ aiDebug.input.up ? "↑" : aiDebug.input.down ? "↓" : "중립" }}
            {{ aiDebug.input.action ? "+ Power" : "" }}</b
          ></span
        ></template
      >
      <small
        >같은 브라우저 시계에서 측정한 RAF·입력/코어/이벤트 처리 값입니다.
        모니터의 광학 지연이나 실제 네트워크 RTT를 뜻하지 않습니다.</small
      >
    </section>
    <p class="small-screen-note">
      물리 키보드를 연결해 주세요. 모바일 터치 조작은 지원하지 않습니다.
    </p>
  </main>
</template>

<script setup lang="ts">
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  reactive,
  ref,
  shallowRef,
} from "vue";
import { useRoute } from "vue-router";
import {
  cloneGameState,
  createGame,
  createSeededRng,
  Side,
} from "../../../shared/game-core";
import { AiController, createAiController } from "../../../shared/ai";
import {
  bindingError,
  copyBindings,
  DEFAULT_BINDINGS,
  KeyboardController,
  keyLabel,
  KEY_OPTIONS,
} from "@/arcade/keyboard-controller";
import { LocalMatchRunner, RunnerMetrics } from "@/arcade/local-match-runner";
import { readPreferences, savePreferences } from "@/arcade/preferences";
import { CourtRenderer } from "@/arcade/court-renderer";
import { AudioFeedback } from "@/arcade/audio-feedback";
import "@/arcade/arcade.css";

const route = useRoute();
const isAi = route.name === "play-ai";
const preferences = reactive(readPreferences());
if (route.query.rule === "classic" || route.query.rule === "power")
  preferences.rule = route.query.rule;
if (
  route.query.difficulty === "easy" ||
  route.query.difficulty === "normal" ||
  route.query.difficulty === "hard"
)
  preferences.difficulty = route.query.difficulty;
if (route.query.keys === "left" || route.query.keys === "right")
  preferences.humanKeys = route.query.keys;
const seed = 20260907;
const canvas = ref<HTMLCanvasElement | null>(null);
const state = shallowRef(createGame({ mode: preferences.rule }));
const metrics = shallowRef<RunnerMetrics>({
  frames: 0,
  ticks: 0,
  fps: 0,
  droppedMs: 0,
  simulationMs: 0,
  maxFrameMs: 0,
  lastSteps: 0,
});
const started = ref(false);
const paused = ref(false);
const pauseReason = ref("");
const errorMessage = ref("");
const lastScorer = ref<Side>("left");
const showDebug = ref(route.query.debug === "1");
const settingsOpen = ref(false);
const draftBindings = reactive(copyBindings(preferences.bindings));
const draftHumanKeys = ref(preferences.humanKeys);
const sides: Side[] = ["left", "right"];
const actions = [
  { value: "up", label: "위로" },
  { value: "down", label: "아래로" },
  { value: "action", label: "Power" },
] as const;
const mappingError = computed(() => bindingError(draftBindings));
let runner: LocalMatchRunner | undefined;
let keyboard: KeyboardController | undefined;
let renderer: CourtRenderer | undefined;
let audio: AudioFeedback | undefined;
let ai: AiController | undefined;
const aiDebug = shallowRef<AiController["debug"] | null>(null);
let motionPreference: MediaQueryList | undefined;
let debugApi:
  | Readonly<{
      snapshot: () => ReturnType<typeof cloneGameState>;
      metrics: () => RunnerMetrics;
      ai: () => AiController["debug"] | null;
    }>
  | undefined;
const leftName = computed(() => (isAi ? "YOU" : "PLAYER 1"));
const rightName = computed(() => (isAi ? "COMPUTER" : "PLAYER 2"));
function labels(side: Side) {
  const binding = preferences.bindings[side];
  return {
    up: keyLabel(binding.up),
    down: keyLabel(binding.down),
    action: keyLabel(binding.action),
  };
}
const leftKeys = computed(() => labels(isAi ? preferences.humanKeys : "left"));
const rightKeys = computed(() => labels("right"));
const statusLabel = computed(() =>
  !started.value
    ? "조작 안내 확인 후 시작"
    : paused.value
    ? "일시 정지"
    : state.value.phase === "finished"
    ? "경기 종료"
    : "LOCAL · 서버 연결 없음"
);

function focusCourt() {
  canvas.value?.focus({ preventScroll: true });
}
function startMatch() {
  if (!runner || !keyboard || errorMessage.value) return;
  settingsOpen.value = false;
  audio?.setMuted(preferences.muted);
  started.value = true;
  paused.value = false;
  focusCourt();
  keyboard.setEnabled(true);
  runner.start();
}
function pause(reason: string) {
  if (!started.value || state.value.phase === "finished") return;
  pauseReason.value = reason;
  paused.value = true;
  keyboard?.setEnabled(false);
  runner?.stop();
}
function resume() {
  if (!runner || document.hidden || errorMessage.value) return;
  settingsOpen.value = false;
  paused.value = false;
  focusCourt();
  keyboard?.setEnabled(true);
  runner.start();
}
function restartMatch() {
  if (isAi)
    ai = createAiController(
      "right",
      preferences.difficulty,
      createSeededRng(seed ^ 0xa17)
    );
  aiDebug.value = ai?.debug || null;
  renderer?.reset();
  keyboard?.clear();
  paused.value = false;
  settingsOpen.value = false;
  focusCourt();
  keyboard?.setEnabled(true);
  runner?.restart();
}
function toggleSound() {
  preferences.muted = !preferences.muted;
  audio?.setMuted(preferences.muted);
  savePreferences(preferences);
}
function openSettings() {
  settingsOpen.value = !settingsOpen.value;
  if (settingsOpen.value) pause("키 설정을 변경하고 있습니다.");
}
function resetBindings() {
  Object.assign(draftBindings.left, DEFAULT_BINDINGS.left);
  Object.assign(draftBindings.right, DEFAULT_BINDINGS.right);
}
function applyBindings() {
  if (mappingError.value) return;
  preferences.bindings = copyBindings(draftBindings);
  preferences.humanKeys = draftHumanKeys.value;
  keyboard?.configure(preferences.bindings);
  savePreferences(preferences);
  settingsOpen.value = false;
}
function redraw() {
  renderer?.draw(
    state.value,
    showDebug.value ? aiDebug.value?.predictedY ?? null : null
  );
}
function motionChanged() {
  renderer?.setReducedMotion(motionPreference?.matches || false);
  redraw();
}

onMounted(async () => {
  await nextTick();
  if (!canvas.value) return;
  try {
    motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    renderer = new CourtRenderer(canvas.value, motionPreference.matches);
    audio = new AudioFeedback();
    if (isAi) {
      ai = createAiController(
        "right",
        preferences.difficulty,
        createSeededRng(seed ^ 0xa17)
      );
      aiDebug.value = ai.debug;
    }
    keyboard = new KeyboardController(
      {
        events: window,
        visibility: document,
        surface: canvas.value,
        isFocused: () => document.activeElement === canvas.value,
        isHidden: () => document.hidden,
        onPause: (reason) =>
          pause(
            reason === "hidden"
              ? "다른 탭으로 이동했습니다."
              : reason === "blur"
              ? "브라우저 포커스를 벗어났습니다."
              : "Escape를 눌렀습니다."
          ),
      },
      preferences.bindings
    );
    const controls = keyboard;
    controls.attach();
    runner = new LocalMatchRunner({
      config: { mode: preferences.rule },
      seed,
      scheduler: {
        request: (callback) => requestAnimationFrame(callback),
        cancel: (id) => cancelAnimationFrame(id),
        now: () => performance.now(),
      },
      input: (current) => {
        const left = controls.read(isAi ? preferences.humanKeys : "left");
        const right = ai ? ai.sample(current) : controls.read("right");
        if (ai) aiDebug.value = ai.debug;
        return { left, right };
      },
      frame: (current, measurement) => {
        state.value = current;
        metrics.value = measurement;
        if (current.phase === "finished") keyboard?.setEnabled(false);
        redraw();
      },
      events: (events) => {
        renderer?.events(events);
        audio?.play(events);
        events.forEach((event) => {
          if (event.type === "point") lastScorer.value = event.side;
        });
      },
      error: (error) => {
        errorMessage.value = error.message;
        keyboard?.setEnabled(false);
      },
    });
    redraw();
    window.addEventListener("resize", redraw);
    motionPreference.addEventListener("change", motionChanged);
    if (
      (process.env.NODE_ENV !== "production" ||
        process.env.VUE_APP_ARCADE_DEBUG === "true") &&
      route.query.debug === "1"
    ) {
      const match = runner;
      debugApi = Object.freeze({
        snapshot: () => match.snapshot,
        metrics: () => match.measurement,
        ai: () => ai?.debug || null,
      });
      Object.defineProperty(window, "__ARCADE_DEBUG__", {
        configurable: true,
        value: debugApi,
      });
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error);
    runner?.dispose();
    keyboard?.dispose();
    audio?.dispose();
  }
});
onUnmounted(() => {
  runner?.dispose();
  keyboard?.dispose();
  audio?.dispose();
  window.removeEventListener("resize", redraw);
  motionPreference?.removeEventListener("change", motionChanged);
  if (
    debugApi &&
    Object.getOwnPropertyDescriptor(window, "__ARCADE_DEBUG__")?.value ===
      debugApi
  )
    Reflect.deleteProperty(window, "__ARCADE_DEBUG__");
});
</script>
