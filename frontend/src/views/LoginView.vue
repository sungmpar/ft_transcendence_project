<template>
  <div class="login-page">
    <header class="login-header"><router-link to="/play">TRANSCENDENCE</router-link><router-link to="/play" data-testid="login-arcade-link">로컬 · AI 플레이 ↗</router-link></header>
    <main class="login-main">
      <section class="login-copy">
        <p class="login-eyebrow">서로 다른 화면, 같은 경기</p>
        <h1>온라인에서<br />함께 플레이하세요.</h1>
        <p>로그인하면 온라인 대전, 친구 초대와 관전을 이용할 수 있어요. 로컬 2인과 AI 대전은 로그인 없이 바로 시작할 수 있습니다.</p>
        <nav aria-label="로그인 없는 플레이" class="login-local-links">
          <router-link to="/play/local">로컬 2인 시작 →</router-link>
          <router-link to="/play/ai">AI 대전 시작 →</router-link>
        </nav>
      </section>
      <section class="login-panel" aria-labelledby="login-title">
        <p class="login-eyebrow">온라인 로그인</p>
        <h2 id="login-title">{{ destination ? destinationLabel + ' 계속하기' : '시작하기' }}</h2>
        <p v-if="destination">로그인과 필요한 계정 확인이 끝나면 선택한 화면으로 이동합니다.</p>
        <p v-else>로그인 후 Home에서 대전 방식을 선택하세요.</p>
        <p v-if="route.query.logout === 'unconfirmed'" class="login-notice" role="status">이 기기에서 로그아웃했습니다. 서버 로그아웃은 확인하지 못했습니다.</p>
        <p v-if="route.query.reason === 'unavailable'" class="login-notice" role="status">온라인 서버 상태를 확인하지 못했습니다. 잠시 후 다시 시도하거나 로컬 · AI로 플레이하세요.</p>
        <button v-if="isGuestLoginEnabled" type="button" class="login-primary" :disabled="guestBusy" @click="signinGuest" data-testid="guest-login">{{ guestBusy ? '로그인 확인 중…' : '게스트로 체험하기' }}</button>
        <p v-else class="login-notice" data-testid="guest-disabled">현재 게스트 로그인이 비활성화되어 있습니다. 로컬 · AI는 계속 플레이할 수 있어요.</p>
        <p v-if="guestError" class="login-notice" role="alert" data-testid="guest-login-error">{{ guestError }}</p>
        <p class="login-small">게스트 버튼은 온라인 체험용 계정을 생성합니다.</p>
        <button v-if="is42LoginEnabled" type="button" class="login-secondary" @click="signin42">42 로그인</button>
        <button v-else class="login-secondary" type="button" disabled>42 로그인 비활성화</button>
        <router-link to="/play" class="login-cancel" @click="clearLoginIntent">온라인 진입 취소 · 플레이 메뉴</router-link>
        <details><summary>로그인이 제한되는 화면이라면</summary><p>임베드 화면에서는 쿠키 정책으로 로그인이 제한될 수 있습니다. <a :href="currentUrl" target="_blank" rel="noopener noreferrer">새 탭에서 열기 ↗</a></p></details>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { clearLoginIntent, readLoginIntent } from '@/arcade/login-intent';
const route = useRoute();
const isGuestLoginEnabled = process.env.VUE_APP_ENABLE_GUEST_LOGIN === 'true';
const is42LoginEnabled = false;
const backendBaseUrl = process.env.VUE_APP_BACKEND_URL || window.location.origin;

const destination = computed(() => { void route.fullPath; return readLoginIntent(); });
const destinationLabel = computed(() => destination.value === '/spectate' ? '경기 관전' : destination.value === '/invite' ? '친구 초대' : destination.value ? '온라인 대전' : '');
const currentUrl = computed(() => {
  const url = new URL('/login', window.location.origin);
  if (destination.value) url.searchParams.set('next', destination.value);
  return url.href;
});
const guestBusy = ref(false), guestError = ref('');
let disposed = false;
let guestRequest: AbortController | undefined;
function signin42() { document.location.href = `${backendBaseUrl}/auth/42`; }
async function signinGuest() {
  if (guestBusy.value) return;
  guestBusy.value = true;
  guestError.value = '';
  const request = new AbortController();
  guestRequest = request;
  const timeout = setTimeout(() => request.abort(), 8000);
  try {
    // One guest request sets the existing cookie. A manual redirect is opaque,
    // so never read or follow its Location: use the existing fixed callback.
    // The router still validates the cookie; errors retain public play links.
    const response = await fetch(`${backendBaseUrl}/auth/guest`, {
      credentials: 'include', redirect: 'manual', signal: request.signal,
    });
    if (disposed) return;
    if (response.type !== 'opaqueredirect') {
      throw new Error('Guest callback was not confirmed');
    }
    document.location.assign(new URL('/login?token=check', window.location.origin).href);
  } catch {
    if (!disposed) guestError.value = '온라인 로그인을 확인하지 못했습니다. 잠시 후 다시 시도하거나 로컬 · AI로 플레이하세요.';
  } finally {
    clearTimeout(timeout);
    if (!disposed) guestBusy.value = false;
  }
}
onUnmounted(() => { disposed = true; guestRequest?.abort(); });
</script>

<style scoped>
.login-page { min-height:100vh; background:#0b101b; color:#eef2ff; padding:0 5vw 48px; font-family:Inter,"Avenir Next",Arial,sans-serif; }
.login-page * { box-sizing:border-box; }
.login-page a:focus-visible,.login-page button:focus-visible,.login-page summary:focus-visible { outline:3px solid #92f0d1; outline-offset:4px; }
.login-header { max-width:1200px; margin:auto; min-height:96px; display:flex; align-items:center; justify-content:space-between; gap:24px; border-bottom:1px solid #293347; }
.login-header>a:first-child { font-size:14px; font-weight:850; letter-spacing:2px; }
.login-header>a:last-child { color:#92f0d1; font-size:14px; }
.login-main { max-width:1100px; margin:80px auto 0; display:grid; grid-template-columns:1.1fr 1fr; align-items:start; gap:70px; }
.login-eyebrow { color:#af9bff; font-size:13px; font-weight:750; margin:0 0 18px; }
.login-copy h1 { font-size:clamp(30px,4vw,52px); letter-spacing:-1.5px; line-height:1.22; font-weight:800; margin:0 0 26px; }
.login-copy>p:not(.login-eyebrow),.login-panel>p:not(.login-eyebrow) { color:#9ca9c0; line-height:1.8; }
.login-local-links { margin-top:32px; display:flex; flex-wrap:wrap; gap:14px 24px; color:#92f0d1; font-weight:700; }
.login-panel { min-width:0; padding:32px; background:#141c2b; border:1px solid #293347; border-radius:16px; }
.login-panel h2 { font-size:25px; font-weight:800; line-height:1.4; margin:0 0 12px; }
.login-panel button { width:100%; border-radius:9px; padding:15px; margin-top:24px; font:inherit; font-weight:750; }
.login-primary { background:#92f0d1; color:#0b101b; }
.login-primary:hover { background:#b7ffe7; }
.login-primary:disabled { cursor:wait; opacity:.7; }
.login-secondary { border:1px solid #47546b; background:transparent; color:#9ca9c0; }
.login-secondary:disabled { cursor:not-allowed; }
.login-panel .login-small { font-size:12px; margin-top:10px; }
.login-panel .login-notice { background:#202c3f; border:1px solid #4a5871; padding:14px; border-radius:8px; color:#eef2ff; font-size:14px; margin-top:18px; }
.login-cancel { display:block; text-align:center; margin:24px 0; font-size:14px; color:#92f0d1; }
.login-panel details { border-top:1px solid #293347; padding-top:20px; font-size:13px; color:#9ca9c0; line-height:1.7; }
.login-panel summary { cursor:pointer; }
.login-panel details p { margin-top:12px; }
.login-panel details a { color:#92f0d1; }
@media(max-width:800px) { .login-main { margin-top:40px; gap:32px; grid-template-columns:1fr; } .login-panel { padding:24px; } .login-header { min-height:80px; flex-wrap:wrap; gap:12px; padding:16px 0; } .login-header>a:first-child { font-size:12px; letter-spacing:1px; } }
</style>
