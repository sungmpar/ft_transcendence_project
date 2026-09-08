<template>
  <section class="launch-rules" aria-label="로컬 및 AI 경기 규칙">
    <div class="launch-rule-label"><strong>경기 규칙</strong><span>로컬 · AI에 적용</span></div>
    <div class="segmented" aria-label="경기 규칙 선택">
      <button :aria-pressed="preferences.rule === 'classic'" @click="setRule('classic')" data-testid="rule-classic">Classic</button>
      <button :aria-pressed="preferences.rule === 'power'" @click="setRule('power')" data-testid="rule-power">Power</button>
    </div>
    <p>{{ preferences.rule === 'classic' ? '공을 받아치고, 먼저 6점을 얻으세요.' : '반사 5회로 충전하고, Power 키로 패들을 확장하세요.' }}</p>
  </section>
  <section class="launch-modes" aria-label="경기 모드 선택">
    <article class="launch-card launch-local">
      <div class="launch-card-label"><span>01 / 함께</span><svg viewBox="0 0 56 32" aria-hidden="true"><path d="M5 8v16M51 8v16M28 2v28"/><circle cx="35" cy="13" r="3"/></svg></div>
      <h2>로컬 2인</h2>
      <p class="launch-card-description">한 화면 · 한 키보드<br />로그인 없이 플레이</p>
      <div class="launch-card-settings launch-duel" aria-label="현재 로컬 조작 키">
        <div><small>플레이어 1</small><span><kbd>{{ label('left', 'up') }}</kbd><kbd>{{ label('left', 'down') }}</kbd><kbd v-if="preferences.rule === 'power'">{{ label('left', 'action') }}</kbd></span></div>
        <div><small>플레이어 2</small><span><kbd>{{ label('right', 'up') }}</kbd><kbd>{{ label('right', 'down') }}</kbd><kbd v-if="preferences.rule === 'power'">{{ label('right', 'action') }}</kbd></span></div>
      </div>
      <router-link :to="destination('local')" class="arcade-button primary mint-button" data-testid="play-local">로컬 2인 시작 <span aria-hidden="true">→</span></router-link>
    </article>
    <article class="launch-card launch-ai">
      <div class="launch-card-label"><span>02 / 혼자 바로 플레이</span><svg viewBox="0 0 56 32" aria-hidden="true"><rect x="12" y="8" width="32" height="20" rx="5"/><path d="M28 8V3M21 16v3M35 16v3M23 23h10"/></svg></div>
      <h2>AI 대전</h2>
      <p class="launch-card-description">내 속도에 맞는 연습 상대<br />로그인 없이 플레이</p>
      <div class="launch-card-settings launch-ai-settings">
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
      <p class="launch-card-description">서로 다른 화면에서 대결<br />온라인 로그인 필요</p>
      <div class="launch-card-settings launch-online-note"><p>상대 찾기는 로비에서 시작합니다.</p><small>서버가 경기 규칙을 확정합니다.<br />두 사람이 Power를 선택하면 Power 경기.</small></div>
      <router-link :to="onlineDestination" class="arcade-button primary" data-testid="play-online">{{ authenticated ? '온라인 로비로' : '로그인하고 대전' }} <span aria-hidden="true">→</span></router-link>
    </article>
  </section>
  <p class="launch-key-note">이동 키가 먼저, Power 키는 마지막입니다. 경기 화면에서 키를 변경할 수 있습니다.</p>
  <slot name="community" />
  <details class="launch-help">
    <summary>처음 오셨나요? 규칙과 프로젝트 안내</summary>
    <div>
      <p>공을 받아쳐 상대 골에 넣으면 1점, 먼저 6점을 얻으면 승리합니다. 로컬·AI는 경기 화면의 ‘경기 시작’을 눌러야 시작합니다. AI는 선택한 키로 왼쪽 패들을 조작합니다.</p>
      <p>Power는 유효 반사 5회로 충전합니다. 능력 키로 확장한 뒤 반사마다 한 칸씩 소모하며, 0칸이면 원래 크기로 돌아옵니다.</p>
      <p>온라인은 두 계정이 각각 로비에서 상대 찾기를 누릅니다. 친구 초대는 접속 중인 친구를 선택하세요. 관전은 별도 계정으로 진행 중인 경기를 선택하며 패들을 조작하지 않습니다.</p>
      <p>42서울 팀 프로젝트의 Pong·인증·채팅·친구·전적 위에 공통 경기 코어와 로컬·규칙 기반 AI를 연결했습니다. 로컬·AI 결과는 서버 전적에 저장되지 않습니다.</p>
    </div>
  </details>
  <p class="launch-device-note">물리 키보드로 플레이하세요. 모바일에서는 메뉴를 이용할 수 있으며, 터치 플레이는 지원하지 않습니다.</p>
</template>
<script setup lang="ts">
import { computed, defineProps, reactive } from 'vue';
import { RuleMode, Side } from '../../../../shared/game-core';
import { readPreferences, savePreferences } from '@/arcade/preferences';
import { keyLabel, PlayerBindings } from '@/arcade/keyboard-controller';
const props = defineProps<{ authenticated?: boolean }>();
const preferences = reactive(readPreferences());
const levels = [{ value: 'easy', label: '쉬움' }, { value: 'normal', label: '보통' }, { value: 'hard', label: '어려움' }] as const;
const onlineDestination = computed(() => props.authenticated ? '/game' : { path: '/login', query: { next: '/game' } });
function save() { savePreferences(preferences); }
function setRule(rule: RuleMode) { preferences.rule = rule; save(); }
function setDifficulty(difficulty: 'easy' | 'normal' | 'hard') { preferences.difficulty = difficulty; save(); }
function label(side: Side, action: keyof PlayerBindings) { return keyLabel(preferences.bindings[side][action]); }
function bindingLabel(side: Side) { return [label(side, 'up'), label(side, 'down'), ...(preferences.rule === 'power' ? [label(side, 'action')] : [])].join(' / '); }
function destination(mode: 'local' | 'ai') { return { path: `/play/${mode}`, query: { rule: preferences.rule, difficulty: preferences.difficulty, keys: preferences.humanKeys } }; }
</script>
