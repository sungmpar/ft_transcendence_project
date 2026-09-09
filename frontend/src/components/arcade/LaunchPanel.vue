<template>
  <section class="launch-rules" aria-label="로컬 및 AI 경기 규칙">
    <div class="launch-rule-label"><strong>경기 규칙</strong><span>로컬 · AI에 적용</span></div>
    <div class="segmented" aria-label="경기 규칙 선택">
      <button :aria-pressed="preferences.rule === 'classic'" @click="setRule('classic')" data-testid="rule-classic">Classic</button>
      <button :aria-pressed="preferences.rule === 'power'" @click="setRule('power')" data-testid="rule-power">Power</button>
    </div>
    <p>{{ preferences.rule === 'classic' ? '기본 규칙(Classic)은 먼저 6점을 얻으면 승리합니다.' : '확장 패들 규칙(Power)은 공을 다섯 번 받아치면 충전됩니다.' }}</p>
  </section>
  <section class="launch-modes" aria-label="경기 모드 선택">
    <article class="launch-card launch-local">
      <div class="launch-card-label"><span>01 / 함께</span><svg viewBox="0 0 56 32" aria-hidden="true"><path d="M5 8v16M51 8v16M28 2v28"/><circle cx="35" cy="13" r="3"/></svg></div>
      <h2>로컬 2인</h2>
      <p class="launch-card-description">한 컴퓨터에서 키보드를 나눠 쓰며 대결합니다.<br />로그인 없이 시작할 수 있습니다.</p>
      <div class="launch-card-settings launch-duel" aria-label="현재 로컬 조작 키">
        <div v-for="side in sides" :key="side"><small>{{ side === 'left' ? '플레이어 1 · 왼쪽' : '플레이어 2 · 오른쪽' }}</small><div class="launch-key-list"><span v-for="action in visibleActions" :key="action.value" class="launch-key"><small>{{ action.label }}</small><kbd>{{ label(side, action.value) }}</kbd></span></div></div>
      </div>
      <router-link :to="destination('local')" class="arcade-button primary mint-button" data-testid="play-local">로컬 2인 시작 <span aria-hidden="true">→</span></router-link>
    </article>
    <article class="launch-card launch-ai">
      <div class="launch-card-label"><span>02 / 혼자 바로 플레이</span><svg viewBox="0 0 56 32" aria-hidden="true"><rect x="12" y="8" width="32" height="20" rx="5"/><path d="M28 8V3M21 16v3M35 16v3M23 23h10"/></svg></div>
      <h2>AI 대전</h2>
      <p class="launch-card-description">혼자 연습할 수 있는 컴퓨터 상대입니다.<br />로그인 없이 시작할 수 있습니다.</p>
      <div class="launch-card-settings launch-ai-settings">
        <p class="launch-setting-note">쉬움·보통·어려움 중에서 난이도를 선택하세요.</p>
        <div class="segmented difficulty" aria-label="AI 난이도">
          <button v-for="level in levels" :key="level.value" :aria-pressed="preferences.difficulty === level.value" @click="setDifficulty(level.value)" :data-testid="`difficulty-${level.value}`">{{ level.label }}</button>
        </div>
        <label>내 조작 키 <select v-model="preferences.humanKeys" @change="save" data-testid="hub-human-keys"><option value="left">{{ bindingLabel('left') }}</option><option value="right">{{ bindingLabel('right') }}</option></select></label>
      </div>
      <router-link :to="destination('ai')" class="arcade-button primary violet-button" data-testid="play-ai">AI와 대전 <span aria-hidden="true">→</span></router-link>
    </article>
    <article class="launch-card launch-online">
      <div class="launch-card-label"><span>03 / 온라인에서 만나기</span><svg viewBox="0 0 56 32" aria-hidden="true"><rect x="2" y="5" width="19" height="17" rx="2"/><rect x="35" y="5" width="19" height="17" rx="2"/><path d="M11 22v5M44 22v5M7 27h8M40 27h8M25 12h6M25 17h6"/></svg></div>
      <h2>온라인 대전</h2>
      <p class="launch-card-description">서로 다른 화면에서 대결합니다.<br />온라인 로그인이 필요합니다.</p>
      <div class="launch-card-settings launch-online-note"><p>온라인 로비에서 ‘상대 찾기’를 누르세요.</p><small>두 사람이 모두 Power를 선택하면 Power 규칙으로 진행합니다. 한 사람이라도 Classic을 선택하면 Classic 규칙으로 진행합니다.</small></div>
      <router-link :to="onlineDestination" class="arcade-button primary" data-testid="play-online">{{ authenticated ? '온라인 로비로' : '로그인하고 대전' }} <span aria-hidden="true">→</span></router-link>
    </article>
  </section>
  <p class="launch-key-note">{{ preferences.rule === 'power' ? '표시된 키는 위로 이동, 아래로 이동, Power 사용 순서입니다.' : '표시된 키는 위로 이동, 아래로 이동 순서입니다.' }} 경기 화면에서 키를 바꿀 수 있습니다.</p>
  <slot name="community" />
  <details class="launch-help">
    <summary>처음 오셨나요? 모드별 플레이 방법</summary>
    <div>
      <h3>기본 규칙과 로컬 2인</h3>
      <p>공을 받아치는 막대를 패들이라고 합니다. 상대 골에 공을 넣으면 1점을 얻고 먼저 6점을 얻으면 승리합니다. 로컬 2인은 한 컴퓨터에서 키보드를 나눠 쓰며 대결합니다. 조작키를 확인한 뒤 ‘경기 시작’을 누르세요.</p>
      <h3>AI 대전</h3>
      <p>난이도와 사용할 키를 선택한 뒤 시작하세요. AI 대전에서는 선택한 키로 왼쪽 패들을 움직입니다. 오른쪽 패들은 컴퓨터가 조작합니다. 로컬 2인과 AI 대전은 로그인이 필요하지 않고 결과도 온라인 전적에 저장되지 않습니다.</p>
      <h3>확장 패들 규칙(Power)</h3>
      <p>공을 패들로 다섯 번 받아치면 Power가 충전됩니다. 공이 오가는 중 Power 키를 누르면 패들이 길어집니다. 길어진 상태에서 공을 받아칠 때마다 충전 칸이 하나씩 줄고, 모두 소모하면 원래 길이로 돌아옵니다. 이동하면서 사용할 수 있습니다.</p>
      <h3>온라인 대전</h3>
      <p>각 플레이어가 자신의 기기나 별도의 브라우저 프로필에서 로그인합니다. 두 사람 모두 온라인 로비에서 ‘상대 찾기’를 누르면 대전이 시작됩니다. 같은 계정의 여러 탭은 두 플레이어가 아닙니다. 혼자 연습하려면 AI 대전을 선택하세요.</p>
      <h3>친구 초대와 관전</h3>
      <p>친구 목록에서 상대를 선택해 초대를 보내세요. 상대방도 온라인 게임 화면에 연결되어 있어야 하며, 경기나 매칭 중에는 초대할 수 없습니다. 초대 대전은 초대를 보낸 사람이 선택한 규칙으로 진행합니다.</p>
      <p>관전하려면 별도 계정으로 진행 중인 경기를 선택하세요. 관전 중에는 패들을 조작할 수 없습니다.</p>
    </div>
  </details>
  <p class="launch-device-note">물리 키보드로 플레이하세요. 모바일에서는 메뉴를 이용할 수 있으며, 터치 플레이는 지원하지 않습니다.</p>
  <ProjectInfo />
</template>
<script setup lang="ts">
import { computed, defineProps, reactive } from 'vue';
import { RuleMode, Side } from '../../../../shared/game-core';
import { readPreferences, savePreferences } from '@/arcade/preferences';
import { keyLabel, PlayerBindings } from '@/arcade/keyboard-controller';
import ProjectInfo from '@/components/arcade/ProjectInfo.vue';
const props = defineProps<{ authenticated?: boolean }>();
const preferences = reactive(readPreferences());
const levels = [{ value: 'easy', label: '쉬움' }, { value: 'normal', label: '보통' }, { value: 'hard', label: '어려움' }] as const;
const sides: Side[] = ['left', 'right'];
const actions = [{ value: 'up', label: '위로' }, { value: 'down', label: '아래로' }, { value: 'action', label: 'Power' }] as const;
const visibleActions = computed(() => actions.filter(action => preferences.rule === 'power' || action.value !== 'action'));
const onlineDestination = computed(() => props.authenticated ? '/game' : { path: '/login', query: { next: '/game' } });
function save() { savePreferences(preferences); }
function setRule(rule: RuleMode) { preferences.rule = rule; save(); }
function setDifficulty(difficulty: 'easy' | 'normal' | 'hard') { preferences.difficulty = difficulty; save(); }
function label(side: Side, action: keyof PlayerBindings) { return keyLabel(preferences.bindings[side][action]); }
function bindingLabel(side: Side) { return visibleActions.value.map(action => `${action.label} ${label(side, action.value)}`).join(' · '); }
function destination(mode: 'local' | 'ai') { return { path: `/play/${mode}`, query: { rule: preferences.rule, difficulty: preferences.difficulty, keys: preferences.humanKeys } }; }
</script>
