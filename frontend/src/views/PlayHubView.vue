<template>
  <main class="arcade-page arcade-hub" data-testid="play-hub">
    <nav class="arcade-nav" aria-label="Arcade navigation">
      <router-link class="arcade-brand" to="/play"
        ><span class="brand-mark">Ⅱ</span> TRANSCENDENCE
        <span class="brand-sub">ARCADE</span></router-link
      >
      <router-link class="quiet-link" to="/login">온라인 서비스 ↗</router-link>
    </nav>
    <section class="hub-intro">
      <div>
        <p class="eyebrow"><span class="status-dot"></span> JUST PRESS PLAY</p>
        <h1>ONE KEYBOARD.<br /><span>TWO RIVALS.</span></h1>
        <p class="hub-description">
          옆자리 친구와, 또는 컴퓨터와.<br />로그인 없이 바로 시작하는 한 화면
          Pong.
        </p>
      </div>
      <div class="hub-court" aria-hidden="true">
        <div class="mini-score"><span>04</span><span>03</span></div>
        <div class="mini-net"></div>
        <div class="mini-circle"></div>
        <div class="mini-paddle mint"></div>
        <div class="mini-paddle violet"></div>
        <div class="mini-ball"></div>
        <div class="mini-trail"></div>
        <span class="mini-label">KEEP THE RALLY ALIVE</span>
      </div>
    </section>
    <section class="rule-strip" aria-label="게임 규칙">
      <div>
        <p class="eyebrow">01 / CHOOSE YOUR RULES</p>
        <p>같은 코트, 두 가지 플레이.</p>
      </div>
      <div class="segmented" aria-label="Rule mode">
        <button
          :aria-pressed="preferences.rule === 'classic'"
          @click="setRule('classic')"
          data-testid="rule-classic"
        >
          Classic
        </button>
        <button
          :aria-pressed="preferences.rule === 'power'"
          @click="setRule('power')"
          data-testid="rule-power"
        >
          Power
        </button>
      </div>
      <p class="rule-explanation">
        {{
          preferences.rule === "classic"
            ? "공을 받아치고, 먼저 6점을 얻으세요."
            : "반사 5회 충전 → 확장 패들. 강화 상태에서 반사할 때마다 1칸 소모합니다."
        }}
      </p>
    </section>
    <section class="mode-grid" aria-label="경기 모드 선택">
      <article class="mode-card local-card">
        <div class="card-topline">
          <span class="mode-number">01</span
          ><span class="mode-tag">2 PLAYERS · SAME SCREEN</span>
        </div>
        <h2>옆자리 라이벌</h2>
        <p>
          키보드 하나를 나눠 잡고 바로 대결하세요.<br />같은 화면, 같은 규칙,
          마지막 한 점까지.
        </p>
        <div class="key-duel" aria-label="기본 조작">
          <span><small>PLAYER 1</small><kbd>W</kbd><kbd>S</kbd></span
          ><b>VS</b><span><small>PLAYER 2</small><kbd>↑</kbd><kbd>↓</kbd></span>
        </div>
        <router-link
          :to="destination('local')"
          class="arcade-button primary mint-button"
          data-testid="play-local"
          >로컬 2인 시작 <span>↗</span></router-link
        >
      </article>
      <article class="mode-card ai-card">
        <div class="card-topline">
          <span class="mode-number">02</span
          ><span class="mode-tag">YOU vs COMPUTER</span>
        </div>
        <h2>나만의 연습 상대</h2>
        <p>
          공의 궤적을 읽는 규칙 기반 AI.<br />반응 속도와 예측 오차가 다른 세
          난이도.
        </p>
        <div class="ai-options">
          <div class="segmented difficulty" aria-label="AI 난이도">
            <button
              v-for="level in levels"
              :key="level.value"
              :aria-pressed="preferences.difficulty === level.value"
              @click="setDifficulty(level.value)"
              :data-testid="`difficulty-${level.value}`"
            >
              {{ level.label }}
            </button>
          </div>
          <label
            >내 조작 키
            <select v-model="preferences.humanKeys" @change="save">
              <option value="left">W / S / D</option>
              <option value="right">↑ / ↓ / ←</option>
            </select></label
          >
        </div>
        <router-link
          :to="destination('ai')"
          class="arcade-button primary violet-button"
          data-testid="play-ai"
          >AI와 대전 <span>↗</span></router-link
        >
      </article>
    </section>
    <footer class="hub-footer">
      <span
        >6점 선승 <i>·</i> 서버·계정·DB 없이 플레이 <i>·</i> 경기 화면에서 키
        변경 가능</span
      ><span>BUILT ON THE TEAM'S PONG</span>
    </footer>
    <p class="small-screen-note">
      두 사람이 함께 플레이하려면 물리 키보드와 넓은 화면이 필요합니다. 모바일
      터치 조작은 지원하지 않습니다.
    </p>
  </main>
</template>

<script setup lang="ts">
import { reactive } from "vue";
import { RuleMode } from "../../../shared/game-core";
import { readPreferences, savePreferences } from "@/arcade/preferences";
import "@/arcade/arcade.css";

const preferences = reactive(readPreferences());
const levels = [
  { value: "easy", label: "Easy" },
  { value: "normal", label: "Normal" },
  { value: "hard", label: "Hard" },
] as const;
function save() {
  savePreferences(preferences);
}
function setRule(rule: RuleMode) {
  preferences.rule = rule;
  save();
}
function setDifficulty(difficulty: "easy" | "normal" | "hard") {
  preferences.difficulty = difficulty;
  save();
}
function destination(mode: "local" | "ai") {
  return {
    path: `/play/${mode}`,
    query: {
      rule: preferences.rule,
      difficulty: preferences.difficulty,
      keys: preferences.humanKeys,
    },
  };
}
</script>
