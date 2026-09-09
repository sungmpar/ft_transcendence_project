# 접속 호환성·LNA·문구 정비 — 기준과 범위

실행 명세: `/Users/sm/Downloads/ft_transcendence_compatibility_lna_copy_codex_v2_20260909.md` 전체. 이전 LNA 진단 명세는 적용하지 않는다. 최종 검사 결과는 TEST_REPORT에 별도로 기록한다. 이 문서는 수정 권한과 기준을 설명하며 운영 배포 완료 판정이 아니다.

## 수정 전 gate

- 정확한 저장소: `sungmpar/ft_transcendence_project`, origin `https://github.com/sungmpar/ft_transcendence_project`.
- 현재 `main`, HEAD·origin/main `ecbb0ee30694f372b8e6e51c1642ef258681443d`. 이전 Home 개편은 이미 이 공개 baseline에 포함됐다. 그 작업을 이번 미커밋 성과로 집계하지 않는다.
- 소스 수정 전 `git status --porcelain=v1 --untracked-files=all` 빈 출력, 단일 worktree, staged0. `git fetch origin` 실제 exit0, merge/reset/checkout 없음. 추가 CONTRIBUTING/AGENTS 파일 없음; 사용자 제공 규칙 적용.
- GitHub 조회 2026-09-08 18:28:07–18:31:31 UTC: repository/default main 일치, archived/disabled false. open issue/PR의 `per_page=100&page=1`이 각각 빈 배열이므로 목록 소진. 관련 issue 상세·claim·timeline 및 PR changed-file/diff는 대상 없음(N/A).
- 인증, LNA/CORS, HMR, URL env, Home/소개/문구, 관련 경로/시험, Docker/proxy의7그룹을 open issue/PR로 각각 검색한14개 요청 모두 total_count0/incomplete_results false. 초기 qualifier 누락422와 교정 후 성공을 구분한다. 직접 중복·의미상 대체·단순 인접 활성 작업은 발견되지 않았다.
- 관측 가능한 pinned전체/최근50개 작업에서 같은 저장소의 활성 작업은 현재 작업 하나였다. 다른 같은 저장소 작업은 마지막 turn completed였다. Git lock0. 이는 숨은 외부 작업 부재 보장이 아니다.
- README/manifests/기존 source/tests와 설치 runtime을 읽었다. Node18.20.8, Vue3.2.37, VueCLI5.0.8, WDS4.9.3, Jest28.0.3, Socket.IO4.5.1, Playwright1.55.0, Chrome152.0.7977.77, PostgreSQL14.23을 이번에 직접 확인했다. 기존 격리 fixture/테스트를 사용할 수 있으며 테스트 의도를 새 navigation 계약에 맞춰 검증 가능하다.
- **GO:** live 가용성, 의미상 중복 안전성, 현재 코드, 회귀 시험 가능성, 범위·충돌 위험을 통과했다. 운영 권한창 직접 관측 불가는 로컬 복원과 문구 정비를 막는 gate가 아니며 별도 미검증으로 남긴다.

## 실제 운영 첫 로딩 관찰

권한을 사전 허용하거나 보안을 끄지 않은 새 Chrome 프로필에서 공개 `/login`을 버튼 클릭 없이 읽었다. 문서와 JS는 `20.194.105.25:443`의 HTTPS200/Public이었다. 실제 HMR WebSocket 목적지는 **`ws://172.18.0.3:3000/ws`**였고 Initiator는 webpack-dev-server의 WebSocketClient→socket→client/index였다. guest 요청과 계정 생성은 하지 않았다.

Chrome 앱의 native 화면 접근은 승인되지 않았다. 따라서 LNA 권한창 직접 관측은 BLOCKED이며, `permissions.query`의 prompt 상태와 network 기록을 팝업 캡처로 부르지 않는다. public probe는 수집 뒤 stdin 대기에서 EOF로 exit1이었으며 이 도구 수명 실패를 제품 PASS로 바꾸지 않는다. 새 Chrome 프로세스는 종료했다. 상세 증거는 DIAGNOSIS와 evidence에 보존한다.

## 보존과 금지

기존 팀 인증·2FA·채팅·친구·전적, 공통 경기 코어와 새 로컬/AI/온라인, clockEpoch·복구·이벤트·화면 개선을 보존한다. 규칙/프로토콜을 문구에 맞춰 바꾸지 않는다. 과거 두 문서 폴더의 내용은 변경하지 않았다. 초기 baseline unit 실행에서 기존 clock-recovery 증거 writer가 같은 파일을 다시 썼지만 HEAD와 바이트가 같았고 git diff는 없었다. 이후 그 시험과 auth 시험은 ARCADE_EVIDENCE_DIR을 지원하도록 바꿔 새 경로로 기록했다.

허용 범위는 로컬 소스·시험·문서와 소유한 격리 fixture다. commit/push/PR/comment/branch/운영 배포·재시작·env·DB 변경은 하지 않는다. 운영 guest endpoint는 읽기 조사로 호출하지 않는다.

## 후속 확인과 변경 소유권

P1/P2 편집 직전 19:01:54–55 UTC, P3 직전 19:19:48–49 UTC, 최종 검사 단계 19:43:39–42 UTC의 live main은 모두 ecbb0ee 그대로였다. 각 시점 open issue/PR 목록은 빈 배열로 소진됐으며 관련 diff는 N/A다. [최종 gate](evidence/final-gate.json)는 로컬 main·단일 worktree·staged0·lock0과 등록된 변경 범위를 함께 기록한다. 기능 완료를 이 gate만으로 판정하지 않는다.

소스 편집은 P1의 guest 인증 경계, P2의 vue.config HMR 기본값, P3/P4의 정적 소개·화면 문구와 이를 확인하는 시험·증거로 제한했다. 기존 팀 코드를 단독 작성한 성과로 재분류하지 않았다. [소스 해시 대조](evidence/after-source-hashes.json)의 공통 코어·AI·두 runner·online session/buffer·router/intent·게임 socket·manifests/lockfiles 15개 보호 경로는 수정 전과 같다.

## 최종 변경 파일 목록

[최종 파일별 상태·SHA](evidence/completion-local-state.json)에 실제 경로를 기록했다. staged0이며 저장소 전체 rollback·branch 변경·commit은 없다. 신규 문서·정제된 로그·PNG는 이 문서와 같은 폴더 안에 있다.

### 제품 소스

- [backend/src/auth/auth.controller.ts](../../backend/src/auth/auth.controller.ts)
- [frontend/src/arcade/launch.css](../../frontend/src/arcade/launch.css)
- [frontend/src/arcade/online-result.ts](../../frontend/src/arcade/online-result.ts)
- [frontend/src/components/SideBar.vue](../../frontend/src/components/SideBar.vue)
- [frontend/src/components/arcade/LaunchPanel.vue](../../frontend/src/components/arcade/LaunchPanel.vue)
- [frontend/src/components/game/OnlineGameShell.vue](../../frontend/src/components/game/OnlineGameShell.vue)
- [frontend/src/views/GameView.vue](../../frontend/src/views/GameView.vue)
- [frontend/src/views/HomeView.vue](../../frontend/src/views/HomeView.vue)
- [frontend/src/views/InviteGameView.vue](../../frontend/src/views/InviteGameView.vue)
- [frontend/src/views/LocalPlayView.vue](../../frontend/src/views/LocalPlayView.vue)
- [frontend/src/views/LoginView.vue](../../frontend/src/views/LoginView.vue)
- [frontend/src/views/PlayHubView.vue](../../frontend/src/views/PlayHubView.vue)
- [frontend/vue.config.js](../../frontend/vue.config.js)
- [frontend/src/arcade/guest-navigation-url.ts](../../frontend/src/arcade/guest-navigation-url.ts) — 신규
- [frontend/src/components/arcade/ProjectInfo.vue](../../frontend/src/components/arcade/ProjectInfo.vue) — 신규

### 검증 코드

- [backend/src/game/clock-recovery.spec.ts](../../backend/src/game/clock-recovery.spec.ts)
- [backend/src/game/online-result.spec.ts](../../backend/src/game/online-result.spec.ts)
- [backend/test/home-auth-prerequisites.e2e-spec.ts](../../backend/test/home-auth-prerequisites.e2e-spec.ts)
- [backend/test/home-guest-entry.e2e-spec.ts](../../backend/test/home-guest-entry.e2e-spec.ts)
- [scripts/browser-home-auth.py](../../scripts/browser-home-auth.py)
- [scripts/browser-local-modes.py](../../scripts/browser-local-modes.py)
- [scripts/browser-online-final.py](../../scripts/browser-online-final.py)
- [scripts/check-arcade.cjs](../../scripts/check-arcade.cjs)
- [backend/src/game/guest-navigation-url.spec.ts](../../backend/src/game/guest-navigation-url.spec.ts) — 신규
- [backend/src/game/guest-redirect-controller.spec.ts](../../backend/src/game/guest-redirect-controller.spec.ts) — 신규
- [backend/test/compat-hmr-jest.json](../../backend/test/compat-hmr-jest.json) — 신규
- [backend/test/compat-hmr.spec.js](../../backend/test/compat-hmr.spec.js) — 신규
- [backend/test/guest-navigation-jest.json](../../backend/test/guest-navigation-jest.json) — 신규
- [scripts/browser-compat-copy.py](../../scripts/browser-compat-copy.py) — 신규
- [scripts/browser-compat-hmr.py](../../scripts/browser-compat-hmr.py) — 신규
- [scripts/compat-hmr-config.cjs](../../scripts/compat-hmr-config.cjs) — 신규
- [scripts/compat-hmr-fixture.cjs](../../scripts/compat-hmr-fixture.cjs) — 신규
- [scripts/compat-hmr-server-trace.cjs](../../scripts/compat-hmr-server-trace.cjs) — 신규

### 실행 안내

- [README.md](../../README.md)

## 마감 확인

20:03:42–44 UTC의 [마감 원격 조회](evidence/completion-remote-gate.json)에서도 main은 같은 SHA였고 열린 이슈·PR은 각각0개였다. [마감 로컬 상태](evidence/completion-local-state.json)는 제품15·검증18·README1개 경로의 미커밋 변경과 staged0을 기록한다. 전용 baseline/after/final 화면 fixture는 모두 정상 종료했다. 최종 정적 미리보기만 실행 중이며 [HTTP·빌드 일치 확인](evidence/final-preview.json)을 남겼다. 기존 사용자 서비스나 PostgreSQL 프로세스는 종료하지 않았다.
