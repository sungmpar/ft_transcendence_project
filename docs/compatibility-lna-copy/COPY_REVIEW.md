# 화면 문구와 기술 소개 검토 — P3 적용 및 수정 후 화면 검토

대상은 `sungmpar/ft_transcendence_project`다. 읽기 기준은 `main`의 `ecbb0ee30694f372b8e6e51c1642ef258681443d`이며, 2026-09-09 KST에 현재 소스와 관련 시험을 대조했다. 처음에는 모든 제안을 미적용 초안으로 작성했다. 이후 명시적으로 배정받은 **P3의 Home/공개 허브/LaunchPanel/ProjectInfo와 한정된 CSS는 소스에 적용**했고 타입·소유 Vue lint를 실행했다. 이후 root가 실행한 수정 후 브라우저 기록을 읽고, 요청받은 **수정 후 PNG 7장을 이 작성자가 직접 열어 검토**했다. 브라우저 실행자는 root이고 이 작성자는 이번 검토에서 Chrome을 새로 실행하거나 플레이하지 않았다. 아래 line은 최초 검토 당시 위치이며 변경 후 달라질 수 있다. Login·LocalPlay·OnlineShell 등 다른 담당자의 적용/시험을 이 작성자의 실행 결과로 취급하지 않는다. 이 작성자는 P3 구현에도 참여했으므로 이 문서는 별도 실행자가 생성한 이미지에 대한 교차 검토이며, P3 구현에 대한 독립 코드 감사로 표기하지 않는다.

공동 기준은 사용자가 지정한 `ft_transcendence_compatibility_lna_copy_codex_v2_20260909.md`의 P3/P4다. 이전 Home 개편의 PASS나 캡처를 이번 문구의 시각 검증으로 재사용하지 않는다.

## 최초 변경 전 의미 검토 — 역사 기록

이 절과 아래 제안 표의 ‘현재 문구’는 **변경 전 기준**이다. ‘미적용’은 초안 작성 당시 상태를 보존한 것이며, 현시점 미완료 판정은 아니다. 실제 적용·관찰 결과는 ‘실제 P3 적용 현황’과 문서 끝의 수정 후 검토를 따른다.

| 항목 | 현재 코드에서 확인한 사실 | 근거 | 제안 상태 |
|---|---|---|---|
| 승리 조건 | 기본 경기 설정은 6점 선승이다. 득점 시 점수를 올리고 `winningScore`에 도달하면 종료한다. | [game-core.ts](../../shared/game-core.ts), 60–65·154–164 | 표현 정비 미적용 |
| AI 조작 주체 | 사람의 선택된 키는 항상 왼쪽 패들의 입력이다. AI는 오른쪽에 생성되어 `ai.sample(current)`로 오른쪽 입력을 낸다. `humanKeys='right'`는 키 구성 선택이지 사람의 패들 위치 변경이 아니다. | [LocalPlayView.vue](../../frontend/src/views/LocalPlayView.vue), 551–556·587–591 | 현재 주체 오류 교정 미적용 |
| AI 난이도 | 쉬움/보통/어려움은 관측 주기·반응 지연·판단 주기·조준 오차·dead zone을 바꾼다. 공의 벽 반사 경로로 도착 위치를 예상한다. 사용자 실력 적응·학습 기능은 없다. | [ai.ts](../../shared/ai.ts), 14–18·47–61·104–136 | 설명 미적용 |
| AI와 사람의 이동 | 양쪽 모두 같은 `stepGame`의 `paddleSpeed / tickRate`와 경계 제한을 거친다. AI 난이도는 별도 이동 속도를 설정하지 않는다. | [game-core.ts](../../shared/game-core.ts), 264–271; [ai.ts](../../shared/ai.ts), 14–18 | 설명 미적용 |
| Power | 자기 패들로 공을 받아칠 때 충전이 최대 5칸까지 오른다. 공이 오가는 중 5칸에서 Power 키를 누르면 높이가 200→400으로 바뀐다. 이동과 Power는 함께 적용할 수 있다. | [game-core.ts](../../shared/game-core.ts), 134–139·240–247·264–271 | 설명 미적용 |
| Power 소모 | 강화 중 받아칠 때마다 **충전량**이 1 감소한다. 높이가 매번 조금씩 줄어드는 것이 아니다. 충전량이 0이 되는 순간 높이가 400→200으로 돌아온다. 벽에 튕김은 충전하지 않는다. | [game-core.ts](../../shared/game-core.ts), 134–139·240–247; [core.spec.ts](../../backend/src/game/core.spec.ts), 177–203 | 명세 초안의 ‘한 칸씩 줄어듦’을 충전 칸으로 명확히 하는 제안 |
| 랜덤 매칭 규칙 | 두 플레이어가 제출한 mode가 모두 true일 때만 Power다. 한쪽이 Classic이면 Classic이다. | [game.service.ts](../../backend/src/game/game.service.ts), 435–454·538–555 | 설명 미적용 |
| 친구 초대 규칙 | 수락 시 초대자의 `invitation.mode`를 두 인수로 전달한다. **초대를 보낸 사람이 선택한 규칙**으로 진행하고 수락자의 현재 select 값은 사용하지 않는다. | [game.service.ts](../../backend/src/game/game.service.ts), 457–474; [InviteSlider.vue](../../frontend/src/components/game/InviteSlider.vue), 52–55 | 랜덤 매칭과 구분하는 안내 미적용 |
| 초대 가능한 상태 | 친구 목록에 이름이 있는 것만으로 충분하지 않다. 대상의 게임 세션이 있고 양쪽이 경기/매칭 중이 아니어야 초대를 보낸다. 받은 목록 payload에는 초대자 ID/이름만 있고 규칙은 없다. | [game.service.ts](../../backend/src/game/game.service.ts), 371–394·419–426 | ‘초대 규칙 미리보기’를 임의로 표시하지 않는 설명 제안 |
| 로컬 기본 키 | 왼쪽 W/S/D, 오른쪽 ↑/↓/←이고 저장된 키로 재지정할 수 있다. 온라인의 ↑/↓/Space와 다르다. | [keyboard-controller.ts](../../frontend/src/arcade/keyboard-controller.ts), 5–8; [online-preferences.ts](../../frontend/src/arcade/online-preferences.ts), 6–10 | 동적 키 표시 유지 제안 |
| 입력 포커스 | 읽기 시 경기장 focus·활성 상태·문서 표시 여부를 검사한다. 온라인 관전자는 keyboard를 비활성화하고 `send()`도 spectator에서 반환한다. | [keyboard-controller.ts](../../frontend/src/arcade/keyboard-controller.ts), 87–95; [online-session.ts](../../frontend/src/arcade/online-session.ts), 95–103·169–177 | 쉬운 설명 미적용 |
| 로그인 복귀 | `/game`, `/invite`, `/spectate`만 허용하며 TTL은 10분이다. 계정 조회/닉네임/2FA 확인은 router에 별도로 있다. callback URL만으로 인증 성공이라고 표시하면 안 된다. | [login-intent.ts](../../frontend/src/arcade/login-intent.ts), 2–34; [router/index.ts](../../frontend/src/router/index.ts), 110–137 | P1 동작과 맞춰 문구 적용 예정 |

## Home·공개 허브·모드 선택

아래 표는 최초 변경 전 문구와 검토안을 보존한다. 그때의 ‘미적용’ 상태를 과거 기록으로 남기고, 실제 P3 적용 내용은 바로 아래 적용 현황에 구분한다. 짧은 버튼명은 유지하고 설명 문단은 `~합니다 / ~할 수 있습니다 / ~하세요`로 맞췄다. Classic/Power와 route/query 값은 그대로다.

| 화면·검토 위치 | 현재 문구 | 제안 문구 | 이유·동작 근거 | 상태 |
|---|---|---|---|---|
| [HomeView](../../frontend/src/views/HomeView.vue):16, [PlayHubView](../../frontend/src/views/PlayHubView.vue):8 | 옆자리 친구와, 컴퓨터와, 온라인 상대와. | 한 키보드로 친구와 대결하거나, AI와 연습하거나, 온라인에서 다른 플레이어와 겨뤄보세요. | 세 실제 CTA를 완전한 문장으로 설명한다. 게임 시작 제목·버튼을 먼저 유지한다. | 미적용 |
| [LaunchPanel](../../frontend/src/components/arcade/LaunchPanel.vue):5–8 | Classic / Power, 반사 5회로 충전하고… | 버튼명 Classic / Power는 유지. 보조 설명은 ‘기본 규칙(Classic)에서는 공을 받아쳐 먼저 6점을 얻으면 승리합니다.’ / ‘확장 패들 규칙(Power)에서는 공을 패들로 다섯 번 받아치면 Power가 충전됩니다.’ | enum/route/query를 번역하지 않고 처음 등장하는 기능명만 풀어 쓴다. 규칙 근거는 위 표. | 미적용 |
| LaunchPanel:14 | 한 화면 · 한 키보드 / 로그인 없이 플레이 | 한 컴퓨터에서 키보드를 나눠 쓰며 두 사람이 대결합니다. 로그인 없이 시작할 수 있습니다. | 로컬 2인의 장점과 조건을 문장으로 설명한다. 긴 사용 방법은 접힌 도움말에 둔다. | 미적용 |
| LaunchPanel:24 | 내 속도에 맞는 연습 상대 / 로그인 없이 플레이 | 혼자 연습할 수 있는 컴퓨터 상대입니다. 쉬움·보통·어려움 중에서 난이도를 선택하세요. | 자동 실력 적응을 암시하지 않는다. 로그인 불필요 조건은 card의 짧은 표시 또는 바로 보이는 안내에 유지한다. | 미적용 |
| LaunchPanel:16–17·29·41 | 키만 나열; 이동 키가 먼저, Power 키는 마지막입니다. | 각 키에 ‘위로’, ‘아래로’, Power일 때 ‘Power’를 표시한다. 보조 문장: ‘표시된 키는 위로 이동, 아래로 이동, Power 사용 순서입니다. 경기 화면에서 키를 바꿀 수 있습니다.’ | `label()`/`bindingLabel()`이 읽는 저장된 bindings를 그대로 사용한다. Classic에서는 세 번째 키가 표시되지 않으므로 보조 문장도 Power 여부에 맞춘다. | 미적용 |
| LaunchPanel:36–37 | 서로 다른 화면에서 대결 / 온라인 로그인 필요; 서버가 경기 규칙을 확정합니다. 두 사람이 Power를 선택하면 Power 경기. | ‘각자 로그인한 뒤 온라인 로비에서 상대를 찾습니다.’ 짧은 설명 뒤 자세한 도움말에 ‘두 사람이 모두 Power를 선택하면 Power 규칙으로 진행합니다. 한 사람이라도 Classic을 선택하면 Classic 규칙으로 진행합니다.’ | 랜덤 매칭용 설명이다. 친구 초대 규칙으로 확대하지 않는다. 로그인 필요 조건을 접힘 밖에 유지한다. | 미적용 |
| LaunchPanel:46 | AI는 선택한 키로 왼쪽 패들을 조작합니다. | AI 대전에서는 선택한 키로 왼쪽 패들을 움직입니다. 오른쪽 패들은 컴퓨터가 조작합니다. | `LocalPlayView`의 실제 left/right 입력과 현재 문구가 반대다. | 미적용 |
| LaunchPanel:46 | 공을 받아쳐 상대 골에 넣으면 1점, 먼저 6점을 얻으면 승리합니다. 로컬·AI는… | 공을 받아치는 막대를 패들이라고 합니다. 상대 골에 공을 넣으면 1점을 얻고 먼저 6점을 얻으면 승리합니다. 로컬 2인과 AI 대전은 조작키를 확인한 뒤 ‘경기 시작’을 누르세요. | ‘패들’을 한 번 설명한다. 모드 링크와 실제 경기 시작 버튼을 구분한다. | 미적용 |
| LaunchPanel:47 | 유효 반사 5회… 능력 키로 확장… 0칸이면 원래 크기… | 공을 패들로 다섯 번 받아치면 Power가 충전됩니다. 공이 오가는 중 Power 키를 누르면 패들이 길어집니다. 길어진 상태에서 공을 받아칠 때마다 충전 칸이 하나씩 줄고, 모두 소모하면 원래 길이로 돌아옵니다. 이동하면서 사용할 수 있습니다. | charge와 paddle 높이를 구분한다. 같은 문장을 로컬/온라인 도움말에서도 재사용할 수 있다. | 미적용 |
| LaunchPanel:48 | 온라인은 두 계정이 각각 로비에서 상대 찾기를 누릅니다. | 각 플레이어가 자신의 기기나 별도의 브라우저 프로필에서 로그인합니다. 두 사람 모두 온라인 로비에서 ‘상대 찾기’를 누르면 대전이 시작됩니다. 같은 계정의 여러 탭은 두 플레이어가 아닙니다. 혼자 연습하려면 AI 대전을 선택하세요. | 세션 소유 보호와 랜덤 매칭 조건을 사용자 행동으로 설명한다. | 미적용 |
| LaunchPanel:48 | 친구 초대는 접속 중인 친구를 선택하세요. | 친구 목록에서 상대를 선택해 초대를 보내세요. 상대방도 온라인 게임 화면에 연결되어 있어야 하며, 경기나 매칭 중에는 초대할 수 없습니다. 초대 대전은 초대를 보낸 사람이 선택한 규칙으로 진행합니다. | chat/친구 목록의 접속 상태와 게임 세션을 혼동하지 않는다. | 미적용 |
| LaunchPanel:49 | 42서울 팀 프로젝트… 공통 경기 코어와 로컬·규칙 기반 AI를 연결했습니다. | 42서울 팀 프로젝트로 만든 Pong과 로그인·채팅·친구·전적 기능을 바탕으로 개선했습니다. 이후 로컬 2인과 규칙 기반 AI를 추가하고, 경기 규칙과 온라인 상태 표시를 정리했습니다. | 공통 기술 소개의 제작 배경으로 옮겨 중복을 줄인다. 팀 기능을 개인의 단독 개발로 바꾸지 않는다. | 미적용 |
| LaunchPanel:52 | 물리 키보드로 플레이하세요. 모바일에서는 메뉴를 이용할 수 있으며, 터치 플레이는 지원하지 않습니다. | 현재 문구 유지 제안 | 실제 미지원 조건을 명확히 말한다. 모바일 메뉴 검사와 터치 경기 지원은 다르다. | 유지 제안 |

Home의 친구·관전·채팅·전적, 공개 허브의 로그인 의도 링크는 그대로 유지한다. 소개를 위해 인증 또는 게임 소켓을 새로 붙이지 않는다.

### 실제 P3 적용 현황

| 변경 파일 | 실제 적용한 내용 | 검증 상태 |
|---|---|---|
| [HomeView](../../frontend/src/views/HomeView.vue), [PlayHubView](../../frontend/src/views/PlayHubView.vue) | 같은 새 소개 문장 ‘한 키보드로 친구와 대결하거나, AI와 연습하거나, 온라인에서 다른 플레이어와 겨뤄보세요.’를 적용했다. 기존 LaunchPanel/계정/서비스 링크는 유지했다. | 소스 적용·타입/lint exit0; 수정 후 1366 화면 직접 검토 및 root 브라우저 단언 확인 |
| [LaunchPanel](../../frontend/src/components/arcade/LaunchPanel.vue) | Classic/Power 이름을 유지하고 규칙 설명을 문장으로 바꿨다. 로컬 설명은 ‘한 컴퓨터에서 키보드를 나눠 쓰며 대결합니다. 로그인 없이 시작할 수 있습니다.’, AI는 ‘혼자 연습할 수 있는 컴퓨터 상대입니다.’와 별도 난이도 선택 안내다. | 소스 적용·타입/lint exit0 |
| LaunchPanel의 동적 키 | 저장된 각 up/down/action을 기존 `label()`로 읽되 kbd 옆에 ‘위로/아래로/Power’를 표시한다. AI select도 같은 역할+실제 키로 표시한다. Classic에서는 Power 키와 Power 순서 안내를 숨긴다. enum·bindings·query 계산 의미는 바꾸지 않았다. | 소스 적용; root 브라우저 기록에서 재지정 키의 Local/Home/허브 및 AI 사용자 왼쪽 조작 단언 true |
| LaunchPanel의 온라인 card/도움말 | 랜덤의 양쪽 Power/한쪽 Classic 조건, AI 사용자 왼쪽·컴퓨터 오른쪽, Power의 충전 칸 감소, 초대자의 규칙과 대상 게임 연결 조건을 적용했다. summary는 ‘처음 오셨나요? 모드별 플레이 방법’이다. | 소스 적용; 펼친 모드 도움말의 최종 문구는 소스와 대조. 이 이미지 검토를 실제 초대·경기 검증으로 계산하지 않음 |
| [ProjectInfo](../../frontend/src/components/arcade/ProjectInfo.vue) | 아래 기술 소개를 실제 정적 컴포넌트로 만들었다. LaunchPanel 하단의 기존 CTA/서비스/사용법 뒤에 추가해 Home과 공개 허브에서 공유한다. root는 Login에서 같은 컴포넌트를 연결한다. | 소스 적용·lint exit0; root 기록의 Tab/Enter/Space·소개 펼치기 전후 추가요청0 단언 true. 아래 확대 PNG 직접 검토 |
| [launch.css](../../frontend/src/arcade/launch.css) | 키 역할의 세로 label, AI select의 wrap/max-width, 도움말 소제목, 설정 영역 위아래 여백만 조정했다. 소개는 자체 scoped CSS로 문서 흐름 안에 배치한다. | 소스 적용; root 기록에서 desktop CTA 첫 viewport 및 390px/CSS 200% 문서 폭 단언 true. 1366/CSS 200% PNG 직접 검토 |

기술 컴포넌트에는 script, import, store, network, timer 또는 lifecycle hook이 없다. 이 소스 확인과 root의 실제 브라우저 추가요청0 단언은 별도 근거다. Login·LocalPlay·OnlineShell·Game/Invite·SideBar·result/session copy는 root 소유이므로 아래 역사적 미적용 검토표를 그 파일들의 최종 적용 판정으로 보지 않는다. 이번에 읽어 확인한 적용 내용만 문서 끝에 구분했다.

## 로그인·이동 안내 — 최초 미적용 제안의 역사 기록

LoginView는 P1 담당자의 행동 변경과 파일 소유권을 공유하지 않는다. 다음은 기존 화면을 읽어 만든 문구 제안이며, 적용 시 최종 navigation 동작을 기준으로 다시 맞춘다.

| 화면·검토 위치 | 현재 문구 | 제안 문구 | 이유·근거 | 상태 |
|---|---|---|---|---|
| [LoginView](../../frontend/src/views/LoginView.vue):8 | …이용할 수 있어요. | 로그인하면 온라인 대전, 친구 초대와 관전을 이용할 수 있습니다. 로컬 2인과 AI 대전은 로그인 없이 바로 시작할 수 있습니다. | 같은 문단의 종결을 통일한다. | 미적용 |
| LoginView:17 | 로그인과 필요한 계정 확인이 끝나면 선택한 화면으로 이동합니다. | 로그인하면 선택한 화면으로 돌아갑니다. 닉네임 설정이나 2단계 인증이 필요한 계정은 해당 절차를 먼저 진행합니다. | allowlisted intent와 기존 router guard를 설명한다. 무조건 인증 성공을 약속하지 않는다. | 미적용 |
| LoginView:18 | 로그인 후 Home에서 대전 방식을 선택하세요. | 로그인하면 홈에서 온라인 대전, 친구 초대, 관전을 선택할 수 있습니다. | 목적지가 없을 때만 표시한다. 화면명 Home을 ‘홈’으로 통일한다. | 미적용 |
| LoginView:19 | 이 기기에서 로그아웃했습니다. 서버 로그아웃은 확인하지 못했습니다. | 이 브라우저에서는 로그아웃했습니다. 서버의 로그아웃 처리는 확인하지 못했습니다. | `auth-session.clearLocalSession()`이 지우는 것은 현재 브라우저의 상태다. 모든 기기 로그아웃을 주장하지 않는다. | 미적용 |
| LoginView:20 | 온라인 서버 상태를 확인하지 못했습니다. 잠시 후 다시 시도하거나 로컬 · AI로 플레이하세요. | 온라인 서버 상태를 확인하지 못했습니다. 잠시 후 다시 시도하거나 로그인 없이 로컬 2인·AI 대전을 이용하세요. | 실패 사실과 가능한 다음 행동을 유지한다. | 미적용 |
| LoginView:21 | 로그인 확인 중… | P1 navigation을 적용한다면 ‘로그인 페이지로 이동 중…’ | 클릭 시 확인한 것은 navigation 시작이다. 계정 인증 완료나 성공 확인을 뜻하지 않게 한다. 실제 버튼 복귀 동작은 P1 시험 대상이다. | 미적용·P1 합의 필요 |
| LoginView:22 | 현재 게스트 로그인이 비활성화되어 있습니다. 로컬 · AI는 계속 플레이할 수 있어요. | 현재 이 데모에서는 게스트 로그인을 사용할 수 없습니다. 로컬 2인과 AI 대전은 로그인 없이 이용할 수 있습니다. | guest flag false일 때만 표시하며 42 활성 여부는 현재 false를 유지한다. | 미적용 |
| LoginView:24 | 게스트 버튼은 온라인 체험용 계정을 생성합니다. | 별도 가입 절차 없이 체험용 계정을 만들어 시작합니다. 로그인하면 온라인 대전과 채팅을 이용할 수 있습니다. | 계정 생성 사실을 문장에 명시한다. 즉시 삭제·저장 없음·완전 익명을 약속하지 않는다. [user.service](../../backend/src/user/user.service.ts)의 기존 User 저장 경로가 있다. | 미적용 |
| LoginView:27 | 온라인 진입 취소 · 플레이 메뉴 | 로그인 없이 플레이하기 | `/play` 이동과 `clearLoginIntent`를 유지한다. 실제 행동을 드러내는 버튼명이다. | 미적용 |
| LoginView:28 | 로그인이 제한되는 화면이라면 / 임베드 화면에서는 쿠키 정책으로… | ‘로그인이 잘되지 않나요?’ 안쪽: ‘노션 등에 삽입된 화면에서는 브라우저의 쿠키 설정 때문에 로그인이 되지 않을 수 있습니다. 새 탭에서 다시 열어 주세요.’ | 원인을 단정하지 않는 가능성 표현이다. 기존 same-origin `/login`+검증된 next, `noopener noreferrer`를 유지하고 `window.top` 이동을 추가하지 않는다. | 미적용 |
| [SideBar](../../frontend/src/components/SideBar.vue):4 | Home (보이는 이름·title·aria-label) | 홈 | route name `'home'`/경로`/`는 유지하고 사용자에게 읽히는 세 이름만 맞춘다. | 미적용 |
| SideBar:15 | 2FA / 2FA 보안 설정 | 보이는 짧은 이름 ‘보안’, 접근 가능한 이름·title ‘2단계 인증 설정’ | 실제 목적지 `/tfa`는 그대로다. 좁은 rail에 긴 문자열을 억지로 넣지 않는다. | 미적용 |

전체 document navigation의 모든 실패를 떠난 SPA에서 잡을 수 있다고 안내하지 않는다. 현재 guest fetch용 실패 문장은 P1이 제거·대체하는 코드 상태에 맞춰 판단하며, 문구를 남기기 위해 다시 guest 확인 fetch를 만들지 않는다.

## 경기·초대·관전 화면

| 화면·검토 위치 | 현재 문구 | 제안 문구 | 이유·근거 | 상태 |
|---|---|---|---|---|
| [LocalPlayView](../../frontend/src/views/LocalPlayView.vue):120–123 | 상대 골에 공을 넣으면 1점. 먼저 6점을 얻으면 승리! | 패들을 움직여 공을 받아치세요. 상대 골에 공을 넣으면 1점을 얻습니다. 먼저 6점을 얻으면 승리합니다. | 길게 연결된 축약 문장을 풀어 쓴다. 점수 의미는 유지한다. | 미적용 |
| LocalPlayView:145 | 좋은 경기였습니다. 한 판 더? | 한 판 더 플레이하려면 ‘다시 대결’을 누르세요. | 감상 대신 다음 행동을 안내한다. | 미적용 |
| LocalPlayView:161 | 준비되면 직접 계속하기를 눌러 주세요. | 준비되면 ‘계속하기’를 눌러 주세요. | 자동 resume가 아닌 기존 사용자 버튼 동작은 유지한다. | 미적용 |
| LocalPlayView:239–241 | 유효 반사 5회로 충전 → 능력 키로 확장… | 위 Power 공통 제안 문장 | charge 소모와 실제 높이 복귀를 정확히 설명한다. | 미적용 |
| LocalPlayView:261·279–280 | WASD 쪽 / 화살표 쪽 | ‘키 구성 1’ / ‘키 구성 2’를 동적 키 요약과 함께 표시. AI 선택에는 ‘왼쪽 패들 조작’을 덧붙인다. | 저장된 키를 바꿨는데 기존 ‘WASD’ 이름이 남는 혼동을 줄인다. 데이터 값 `left/right`와 실제 조작 주체는 유지한다. | 미적용 |
| LocalPlayView:458–465 | 조작 안내 확인 후 시작 / LOCAL · 서버 연결 없음 | ‘조작키를 확인한 뒤 시작하세요.’ / ‘브라우저에서 경기를 진행합니다.’ | ‘서버 연결 없음’은 사이트 첫 로딩까지 인터넷이 불필요하다는 뜻이 아니다. 도움말에는 로그인/게임 서버 연결 불필요와 온라인 전적 미저장을 설명한다. | 미적용 |
| [OnlineGameShell](../../frontend/src/components/game/OnlineGameShell.vue):19·79·88 | 서비스 메뉴 / 메뉴로 돌아가기 | 홈으로 | 실제 목적지 `/`를 말한다. `online-menu` testid 유지. | 미적용 |
| OnlineGameShell:62 | Pong 관전 화면. 플레이어 입력은 보내지 않습니다. | Pong 관전 화면입니다. 관전 중에는 패들을 조작할 수 없습니다. | canvas 접근 가능한 이름도 사용자 용어로 맞춘다. | 미적용 |
| OnlineGameShell:171–172 | 이동 키 / 키 · Power 모드 키 | 위로: {up} · 아래로: {down} · Power: {action} | ‘Power 모드 키’는 규칙 변경 키처럼 보일 수 있다. 실제 `onlineBindings` 값으로 표시한다. | 미적용 |
| OnlineGameShell:177 | 관전은 서버가 보낸 같은 경기 상태를 표시하며 조작 입력을 보내지 않습니다. | 진행 중인 경기를 실시간으로 볼 수 있습니다. 관전 중에는 패들을 조작할 수 없습니다. | 서버/입력 계약의 구현 용어를 줄이고 실제 관전자 제약을 설명한다. 실시간은 무지연 약속이 아니다. | 미적용 |
| OnlineGameShell:178 | …채팅·설정 입력 중에는 게임 키를 가로채지 않습니다. | 경기장을 클릭한 뒤 키보드로 조작하세요. 채팅을 입력하거나 설정을 바꿀 때는 패들이 움직이지 않습니다. | focus를 잃으면 중립 입력을 사용하는 실제 계약. 새 시험에서 확인할 조건이다. | 미적용 |
| OnlineGameShell:181–183 | 유효 반사 5회 충전 → 능력 키로 확장… | 위 Power 공통 제안 문장 | 규칙은 그대로 두고 메모 형식을 문장으로 바꾼다. | 미적용 |
| [GameView](../../frontend/src/views/GameView.vue):208–209 | 상대를 기다립니다. 두 플레이어가 Power를 선택하면 Power 규칙… | 상대를 기다리고 있습니다. 두 사람이 모두 Power를 선택하면 Power 규칙으로 진행합니다. 한 사람이라도 Classic을 선택하면 Classic 규칙으로 진행합니다. | 대기 상태에서만 보이는 랜덤 매칭 안내. 초대에는 적용하지 않는다. | 미적용 |
| [InviteGameView](../../frontend/src/views/InviteGameView.vue):92 및 초대 control 인근 | 친구를 초대하거나 받은 초대를 선택하세요. | 현재 상태 문장은 유지하고 별도 도움말에 ‘초대 대전은 초대를 보낸 사람이 선택한 규칙으로 진행합니다.’를 추가한다. | 수락자의 select 값이 규칙을 바꾸지 않는 사실을 설명한다. payload에 없는 상대 규칙 값을 추정해 UI에 표시하지 않는다. | 미적용 |
| [SpectateView](../../frontend/src/views/SpectateView.vue):74·216·236 | 경기 목록에서 관전할 방을 선택하세요. / 서버에 연결되지 않아… | ‘경기 목록에서 관전할 경기를 선택하세요.’ 연결 실패에는 ‘연결을 확인한 뒤 경기 목록을 다시 열어 주세요.’를 덧붙인다. | room을 ‘경기’로 통일하고 실제 목록 재조회 버튼으로 이어지는 다음 행동을 준다. empty/error/loading 상태를 합치지 않는다. | 미적용 |
| [online-result](../../frontend/src/arcade/online-result.ts):64 | 경기는 종료됐지만 결과 저장 여부는 확인되지 않았습니다. | 경기는 끝났지만 전적 저장 여부를 확인하지 못했습니다. | pending은 저장 실패 확정이 아니다. 종료 사실과 저장 관찰을 분리한다. | 미적용 |
| online-result:54·56·58·60·62 | saved/failed/aborted/retrying/saving별 다른 메시지 | 상태 구분 유지. saving은 ‘경기가 끝났습니다. 전적을 저장하고 있습니다.’, retrying은 ‘경기가 끝났습니다. 전적 저장을 다시 시도하고 있습니다.’ | failed를 pending으로 바꾸거나 저장 성공을 선행 표시하지 않는다. aborted 메시지를 전체 원인에 대해 새로 단정하지 않는다. | 문장 정비 미적용 |

이미 분명한 ‘친구가 초대를 거절했습니다.’, ‘초대를 보냈습니다. 친구의 응답을 기다립니다.’, ‘경기 목록을 불러오지 못했습니다. 연결을 확인하고 다시 시도해 주세요.’ 같은 상태 문구는 유지한다. 영어 장식어까지 전면 번역하거나 기존 팀 채팅 UI를 일괄 정리하는 범위는 제안하지 않는다.

## 연결 진단값의 의미와 이름 — 최초 미적용 제안의 역사 기록

표시 위치는 [OnlineGameShell.vue](../../frontend/src/components/game/OnlineGameShell.vue) 185–221이다. 다음은 label/설명만의 **미적용 제안**이며 metric 이름·단위·산식·enum은 그대로 둔다.

| 현재 → 제안 | 코드 의미와 설명 초안 | 코드 근거 |
|---|---|---|
| 실제 연결 진단값 → 연결 상태 자세히 보기 | 기존 details를 유지한다. 접힌 상태에서도 연결 실패/다음 행동은 다른 실제 status 영역에 남는다. 소개 컴포넌트에서 이 진단을 실행하지 않는다. | OnlineGameShell:185–224 |
| 전송 RTT → 서버 응답 왕복 시간(RTT) | ‘별도 확인 요청을 보낸 뒤 서버 응답을 받을 때까지의 시간입니다. 서버 처리와 브라우저 대기를 포함합니다.’ 마지막 nonce 응답의 `performance.now() - sent`이며 편도 지연이나 물리적인 순수 회선 지연이 아니다. | [online-session.ts](../../frontend/src/arcade/online-session.ts), 264–272; [game.gateway.ts](../../backend/src/game/game.gateway.ts), 31–42 |
| ACK 관측 왕복 → 입력 반영 확인 시간 | ‘보낸 입력을 서버가 반영했다는 경기 상태를 받을 때까지의 시간입니다. 화면에 실제로 표시될 때까지의 시간은 아닙니다.’ 수신 snapshot의 자기 side ack와 pending seq 시각을 비교한다. RTT와 동일한 요청·표본이 아니다. | [online-session.ts](../../frontend/src/arcade/online-session.ts), 169–200 |
| buffer → 보관 중인 경기 상태 수 | snapshot buffer가 보관한 항목 개수다. 항상 미래 상태 수나 곧 보여줄 프레임 수라는 뜻이 아니다. | [snapshot-buffer.ts](../../frontend/src/arcade/snapshot-buffer.ts)의 `metrics.depth`·snapshots |
| 표시 지연 → 추정 표시 지연 | ‘받은 경기 상태로 추정한 서버 시각과 현재 표시 시각의 차이입니다. 편도 네트워크 지연을 직접 측정한 값은 아닙니다.’ 로컬 도착 시각과 tick으로 offset을 추정한 뒤 `(estimatedTick - presentationTick) × tickMs`를 표시한다. | snapshot-buffer:138–139·155–162·199–200 |
| buffer 고갈 → 보간할 다음 상태가 없었던 횟수 | ‘다음 상태를 기다리기 시작한 횟수입니다. 계속 기다리는 동안은 한 번으로 세며, 기다린 프레임 수가 아닙니다.’ interpolate mode에서 target이 newest tick을 넘는 **false→true 전환**을 센다. | snapshot-buffer:165–167; [snapshot-buffer.spec.ts](../../backend/src/game/snapshot-buffer.spec.ts), 106–118 |
| RAF FPS → 화면 갱신 빈도(FPS) | 브라우저 RAF callback 빈도의 약500ms 구간 값이다. 실제 디스플레이가 빛을 낸 프레임 수나 네트워크 품질 점수가 아니다. | online-session:275–280 |
| snapshots → 받은 경기 상태 수 / input messages → 보낸 입력 수 | `snapshots`는 이 session에서 검증·수락한 수신 상태 수이고, `inputMessages`는 키보드 입력 패킷 전송 수다. 전체 transport 메시지 수가 아니다. | online-session:177–182·188–201 |

끝 설명 제안: ‘이 값들은 브라우저와 서버의 동작을 이해하기 위한 정보입니다. 입력 반영 확인 시간은 모니터에 화면이 나타날 때까지의 시간을 뜻하지 않습니다.’ 상세 수식이나 epoch/ACK 용어는 제품 첫 안내로 밀어 올리지 않는다. 서버 이벤트·표시 시점 이벤트·건너뛴 효과 숫자를 성공 횟수나 물리 타격 횟수로 재해석하지 않는다.

## 공통 프로젝트 소개 컴포넌트 제안

**P3 소스 적용:** 작은 [ProjectInfo.vue](../../frontend/src/components/arcade/ProjectInfo.vue)를 만들어 LaunchPanel 하단에서 한 번 사용한다. LoginView의 연결은 root가 소유한다. Home과 공개 `/play`는 같은 LaunchPanel을 통해 제공한다. 새 route·store·network dependency 없이 정적 template과 scoped CSS만 사용했다. 기존 LaunchPanel의 모드 사용법 details와 기술 소개를 구분했다. 아래 표의 ‘미적용’은 최초 검토안 당시 상태이고, 실제 기술 설명 적용은 위 P3 현황을 따른다.

접기 밖에 다음 세 요소를 표시한다.

1. 제목: **프로젝트 소개**
2. 짧은 소개: **두 사람이 공을 주고받으며 먼저 6점을 얻으면 승리하는 Pong 게임입니다. 한 컴퓨터에서 키보드를 나눠 쓰거나, AI와 연습하거나, 온라인으로 대결할 수 있습니다.**
3. 기술 이름: **Vue 3 · TypeScript · Canvas 2D · NestJS · Node.js · Socket.IO(WebSocket 전송) · PostgreSQL · TypeORM**

아래에는 native `<details>`/`<summary>사용한 기술과 경기 방식 알아보기</summary>`를 둔다. 요약 control의 Tab·Enter/Space 동작을 보존하고 focus 스타일을 제공한다. 긴 설명을 펼쳐도 CTA와 계정 메뉴를 겹치지 않게 문서 흐름 안에 둔다. 390px에서 이름 목록이 줄바꿈되도록 하며 고정폭·외부 로고/폰트 다운로드는 추가하지 않는다.

| 기술·제안할 자세한 문장 | 실행 코드 근거 | 주장하지 않을 내용 | 상태 |
|---|---|---|---|
| **Vue 3·TypeScript:** 메뉴와 설정, 경기 상태를 브라우저 화면에 표시합니다. | [frontend/package.json](../../frontend/package.json)의 vue/TypeScript 의존성; [main.ts](../../frontend/src/main.ts)의 `createApp(App).use(router).use(store).mount` | 단순히 패키지에 있다는 이유만으로 사용 여부를 판단하지 않음 | 미적용 |
| **Canvas 2D:** 공과 패들, 경기장과 시각 효과를 그립니다. | [court-renderer.ts](../../frontend/src/arcade/court-renderer.ts), `getContext('2d')`; LocalPlayView/OnlineGameShell의 실제 renderer 생성 | WebGL/3D/새 그래픽 엔진 | 미적용 |
| **NestJS·Node.js:** 온라인 입력을 받아 경기를 진행하고, 로그인과 기존 서비스 API를 제공합니다. | [backend/package.json](../../backend/package.json)의 Nest 실행 명령; [game.gateway.ts](../../backend/src/game/game.gateway.ts)의 이벤트 핸들러; [server-match-runner.ts](../../backend/src/game/server-match-runner.ts)의 서버 step | 현재 운영 프로세스나 Azure 재배포 성공 | 미적용 |
| **Socket.IO:** WebSocket 전송을 사용해 브라우저와 서버가 입력·경기 상태·채팅을 주고받습니다. | [route-game-socket.ts](../../frontend/src/arcade/route-game-socket.ts), 5–8; [router/index.ts](../../frontend/src/router/index.ts), 160–168의 `/chat`; [chat.gateway.ts](../../backend/src/chat/chat.gateway.ts)의 `/chat` namespace | 일반 WebSocket과 Socket.IO가 같은 프로토콜이라는 설명, P2P/WebRTC, 서버 없는 온라인 | 미적용 |
| **PostgreSQL·TypeORM:** 사용자 정보와 채팅, 온라인 경기 결과를 저장하고 조회합니다. | [app.module.ts](../../backend/src/app.module.ts)의 `TypeOrmModule`/postgres; [user.service.ts](../../backend/src/user/user.service.ts)의 repository 저장; [chat.service.ts](../../backend/src/chat/chat.service.ts), 433·447의 메시지 저장; [match.service.ts](../../backend/src/user/match.service.ts)의 실제 Match repository | 게스트 정보 미저장·즉시 삭제·모든 메시지 영구 저장 보장 | 미적용 |
| **공통 TypeScript 코어:** 로컬·AI·온라인 대전에서 같은 경기 규칙을 사용합니다. 로컬·AI는 브라우저에서, 온라인은 서버에서 경기를 진행합니다. | [local-match-runner.ts](../../frontend/src/arcade/local-match-runner.ts), 103과 [server-match-runner.ts](../../backend/src/game/server-match-runner.ts), 117이 같은 [stepGame](../../shared/game-core.ts)을 호출 | 브라우저가 온라인 승패를 최종 결정한다는 설명 | 미적용 |
| **규칙 기반 AI:** 공의 움직임과 벽에 튕기는 경로로 도착 위치를 예상합니다. 난이도에 따라 관측 주기와 반응 시간, 조준 오차가 달라집니다. 패들 이동 속도와 Power 규칙은 사람과 같습니다. | [ai.ts](../../shared/ai.ts)의 설정·predictIntercept·sample; [game-core.ts](../../shared/game-core.ts)의 양쪽 공통 입력 적용 | 학습형/생성형 AI, 사용자 실력 자동 적응, 미래 입력 읽기 | 미적용 |

온라인 표시 설명 제안:

> 온라인에서는 서버가 입력을 반영하고 공과 패들의 위치, 점수와 승패를 계산합니다. 브라우저는 서버가 보내는 상태를 화면에 그립니다. 받은 두 상태 사이의 위치를 계산해 공이 끊겨 보이는 현상을 줄입니다. 이 과정은 움직임을 부드럽게 하지만 화면에 보이는 상태를 조금 늦춥니다. 통신 지연 자체를 줄이는 기능은 아닙니다.

근거는 ServerMatchRunner의 `stepGame`, OnlineSession의 snapshot 수신과 SnapshotBuffer의 두 상태 보간이다. 끊김이 항상 사라지거나 latency가 감소했다고 보장하지 않는다.

로컬·AI 설명 제안:

> 로컬 2인과 AI 대전은 브라우저에서 경기를 진행합니다. 온라인과 같은 경기 규칙을 사용하지만 경기를 시작할 때 로그인하거나 게임 서버에 접속할 필요가 없습니다. 이 모드의 결과는 온라인 전적에 저장되지 않습니다.

근거는 LocalPlayView→LocalMatchRunner의 실행 경로와 public route 분리다. 사이트 첫 로딩에도 인터넷이 필요 없거나 오프라인 설치 앱이라는 뜻으로 확대하지 않는다. 소개 구현 후 새 API/socket/probe가 생기지 않는지는 별도 브라우저 확인이 필요하다.

제작 배경에는 위 표의 팀 기여 설명을 사용한다. 현재 checkout에 있는 README와 과거 기록은 공동 작업/후속 변경의 자료다. AI 보조를 언급한다면 ‘후속 개선 과정에서 AI 코딩 도구의 도움을 받았습니다.’처럼 구분하되, 이 문서 초안 자체가 기능 전체의 단독 저작이나 독립 인간 검증을 증명하지는 않는다. Azure/Docker Compose/Caddy/HTTPS는 운영 상태 확인 전 기술 이름 목록이나 ‘배포 검증 완료’ 문구에 넣지 않는다.

## 최초 적용 전 회귀 계획 — 당시 미실행

아래는 구현 전에 정리한 계획을 보존한 것이다. 이후 실제 수행된 범위는 문서 끝의 69개 단언 및 이미지 검토 기록과 분리한다.

- `data-testid`, route name, `classic/power`, `left/right`, `arrows/wasd`, Socket.IO 이벤트와 metric 필드 이름은 유지한다. 문구와 accessible name에 의존하는 locator는 새 의미를 검증하도록 함께 갱신하되 기능 단언을 삭제하지 않는다.
- [browser-home-auth.py](../../scripts/browser-home-auth.py):133은 기존 취소 링크의 정확한 이름을 클릭한다. 문구 변경 시 실제 public 이동/intent 정리 단언을 그대로 두고 이름만 맞춰야 한다. Home 링크의 `aria-label="Home"`를 사용하는 시험도 적용 전에 재검색한다.
- 저장한 키를 기본값과 다르게 바꾼 뒤 Home/공개 허브/실제 경기의 위로·아래로·Power 역할 표시를 대조한다. AI의 사람은 항상 왼쪽이며 로컬 오른쪽 Power(←)를 온라인 기본 Power(Space)로 잘못 설명하지 않는다.
- 친구 초대의 규칙 설명은 서버가 보낸 실제 시작 snapshot과 대조한다. 수락자의 로컬 select만 보고 규칙을 확정해서 쓰지 않는다. 받은 초대 목록에 규칙을 새로 표시하기 위해 protocol을 확장하지 않는다.
- Home·로그인·허브·온라인을 1440×900, 1366×768, 390×844에서 수정 전후 같은 viewport로 캡처하고 직접 연다. 200% 확대, Tab·focus, native details, 한국어 줄바꿈·긴 기술명, 첫 CTA 접근을 확인한다. 이 문서에서 캡처 생성/열람을 했다고 주장하지 않는다.
- 새 익명 `/play`, `/play/local`, `/play/ai`에서 기술 소개 펼치기 때문에 auth/backend/game socket 요청이 생기지 않는지 확인한다. 로그인과 Home의 기존 계정 요청은 소개가 추가한 요청과 구분한다. 이미 열린 온라인 세션의 기존 `latencyProbe`를 소개 요청으로 세지 않는다.
- 연결됨/복구됨/저장됨은 실제 상태를 받은 경우에만 보여야 한다. failed/pending/aborted와 guest-disabled를 문구 교체로 합치지 않는다.
- 코어 Power·AI·snapshot 시험은 의미 근거로 읽었을 뿐 이 하위작업에서 실행하지 않았다. 향후 P3/P4 검증은 해당 실제 명령·환경·exit와 함께 TEST_REPORT에 기록한다.

## 이번 초안의 작업 기록

README, frontend/backend package scripts, 대상 Vue 파일과 helper, 공통 코어·AI·두 runner, 서버 매칭/초대, chat 저장 및 관련 시험 소스를 Python `Path.read_text()`로 읽었다. repository `AGENTS.md`와 `CONTRIBUTING.md`는 현재 없음을 확인했으며 사용자가 전달한 지침을 따랐다. 환경 변수·인증정보 전체를 수집하지 않았다.

이후 root가 생성한 변경 전1366×768 viewport PNG 네 장을 reviewer가 `view_image`로 **직접 열어** 검토했다. 캡처 생성과 실제 guest 로그인은 root 실행이며 reviewer가 별도 Chrome을 실행하거나 클릭한 것은 아니다. root가 전달한 실행 쌍은 build`99110685ef45f988`/소유 fixture51658이고 운영 화면이 아니다.

| 직접 열어 본 baseline PNG | 이미지에서 확인한 문구·배치 | 한계 |
|---|---|---|
| [로그인1366](evidence/before-login-1366x768.png) | ‘로그인 후 Home…’, ‘…이용할 수 있어요’, 게스트 계정 생성 설명, 취소 링크와 임베드 도움말 summary가 소스와 일치한다. 공개 로컬/AI 링크와 guest 버튼 사이에 눈에 띄는 겹침은 보이지 않는다. 기술 이름 목록은 이 화면에 없다. | details는 접혀 있어 내부 설명을 이 이미지로 검토한 것은 아니다. 실제 로그인/버튼 동작 PASS를 이 정지 화면에서 추정하지 않는다. |
| [공개 허브1366](evidence/before-play-hub-1366x768.png) | 세 CTA가 첫768px 안에 보인다. AI의 ‘내 속도에 맞는 연습 상대’, 온라인의 ‘두 사람이 Power를 선택하면 Power 경기.’, 키 순서 메모가 그대로 보인다. 하단 프로젝트 안내는 접혀 있고 핵심 기술 이름은 접기 밖에 없다. | 긴 이미지 전체 높이와 viewport 높이는 다르다. 소개를 하단에 추가하되 CTA 앞에 삽입하지 않는 제안의 기준이다. |
| [Home1366](evidence/before-home-1366x768.png) | 왼쪽 rail의 Home/2FA, 같은 세 모드 card와 계정 메뉴가 보인다. 현재 card·핵심 CTA에 눈에 띄는 겹침은 없다. 기술 목록은 표시되지 않는다. | root가 준비한 격리 guest 화면이다. 모든 메뉴가 동작했다는 검증이나 모바일 검토가 아니다. |
| [온라인 로비1366](evidence/before-online-lobby-1366x768.png) | ‘서비스 메뉴’, ‘Power 모드 Space’, ‘키를 가로채지 않습니다’, Power 화살표 메모, ‘실제 연결 진단값’ summary가 보인다. 코트의 상대 찾기와 하단 조작 control은 가려지지 않는다. | 연결 문구는 캡처 시 보이는 상태의 관찰이다. 실제 매칭/경기/저장 결과나 접힌 diagnostics 값은 검증하지 않았다. |

이 네 PNG는 full-page 캡처다. 픽셀 높이는 로그인768, 공개 허브913, Home913, 온라인 로비868이며 모두 폭1366이다. 후속 캡처 비교에는 원래1366×768 viewport를 사용하고 전체 PNG 높이를 viewport로 해석하지 않는다. 1440/390의 다른8장은 root 담당이며 이 reviewer가 열었다고 주장하지 않는다.

### 실제 실행한 P3 소유 검사

cwd는 `/Users/sm/dev_park/ft_transcendence_project/frontend`다. 두 명령을 실제 실행했고 각각 process **exit0**였다. 빈 log만으로 추정한 결과가 아니다.

```sh
PATH=/private/tmp/ft-transcendence-runtime/node_modules/.bin:$PATH node node_modules/typescript/bin/tsc --noEmit > ../docs/compatibility-lna-copy/evidence/P3-owned-typecheck.log 2>&1
PATH=/private/tmp/ft-transcendence-runtime/node_modules/.bin:$PATH node node_modules/eslint/bin/eslint.js src/components/arcade/ProjectInfo.vue src/components/arcade/LaunchPanel.vue src/views/HomeView.vue src/views/PlayHubView.vue --no-fix > ../docs/compatibility-lna-copy/evidence/P3-owned-lint.log 2>&1
```

[타입 log](evidence/P3-owned-typecheck.log)와 [소유 Vue lint log](evidence/P3-owned-lint.log)는 진단 없이 종료했다. CSS 시각 검증·Vue 전체 production build·브라우저 상호작용은 이 명령들에 포함되지 않는다. 이 하위작업은 새 시험을 추가하거나 기존 단언을 약화하지 않았다.

당시 단계 상태: **P3_SOURCE_APPLIED / 소유 타입·lint exit0 / baseline PNG4장 직접 검토 / 수정 후 제품·시각 검증 대기**였다. 다음 기록은 그 뒤 수행된 수정 후 검토다.


## 수정 후 브라우저 기록과 실제 이미지 검토

수정 후 실행은 root가 소유한 격리 fixture `http://127.0.0.1:52435`와 frontend build `52546caae6f959a8`을 사용했다. [브라우저 JSON](evidence/after-copy-browser.json)은 `2026-09-08T19:31:26.452496+00:00`, Chrome `152.0.7977.77`, index SHA-256 `d274384d17c47c8ce6da5b3849dd96a5620f2633f2e7c3dd25b1bfb8915875f3`를 기록한다. [실행 출력](evidence/after-copy-browser-command.log)을 함께 읽었다. JSON 전체 상태는 `CAPTURED`이며, 이 작성자가 `checks` 배열을 다시 계산한 결과 **69개 중 69개 true, false 0개, pageErrors 0개**다. 단언 수를 서로 독립된 69회 경기나 69개 Jest 테스트로 바꾸어 세지 않는다. 이 문서 작성자는 해당 브라우저 명령을 직접 실행하지 않았고 process exit를 로그 내용만으로 추정하지 않는다.

[시험 소스](../../scripts/browser-compat-copy.py)의 실제 단언 범위는 다음과 같다.

- Login·Home·공개 허브·온라인 로비의 세 viewport(1440×900, 1366×768, 390×844)에서 문서 가로 넘침 여부, Home/허브의 desktop 세 CTA가 첫 viewport 안에 있는지 검사했다.
- Login·Home·허브에서 소개가 한 번만 표시되고 처음 접혀 있는지, Tab으로 summary에 도착해 focus outline이 있는지, Enter로 열고 Space로 닫히는지 검사했다. 펼치기 전후 HTTP/새 WebSocket 요청 수가 같았다. 기존 Home/온라인의 소켓을 ‘요청 전체 0’으로 잘못 해석하지 않는다.
- 기술 이름 자동 단언은 Vue 3·TypeScript·Canvas 2D·NestJS·Socket.IO·PostgreSQL의 **6종**이다. Node.js·TypeORM까지 **8종**이 접기 밖에 있는지는 아래 실제 이미지와 소스로 별도 확인했다.
- 격리 guest 요청이 정확히 한 번의 document GET이고 fetch가 아니며 실제 cookie callback이 선택한 game 로비로 복귀한 기록이다. 고정 검토 닉네임은 실제 기존 API로 준비했다. 운영 guest 요청은 이 실행에 없다.
- 저장한 키를 바꾼 뒤 Local/Home/허브의 역할 표시와 대응 키, AI 사용자의 왼쪽 패들 이동을 검사했다. 온라인 선택 키의 역할, 진단 설명의 입력 확인 시간/발생 구간 의미도 검사했다. 이 기록의 로비 진입을 실제 온라인 2인 경기 완료로 계산하지 않는다.
- static build에서 HMR 연결과 이동만으로 자동 매칭이 발생하지 않았다는 단언이다. 공개 dev-server의 LNA 권한 UI 또는 P2의 실제 HMR transport 진단 결과를 대체하지 않는다.

확대는 1440×900 viewport에서 `document.documentElement.style.zoom = '2'`를 적용한 **CSS 200% 확대**다. native Chrome 메뉴의 200% 확대를 조작한 시험이 아니며, 해당 브라우저 확대의 viewport/media-query 동작까지 검증했다고 주장하지 않는다. 작은 viewport 시험과 CSS 확대 시험도 서로 다른 경우다.

### 직접 열어 본 수정 후 PNG 7장

이 작성자는 다음 7개 파일을 모두 `view_image`로 열었다. 확대 이미지 3개는 원본 해상도로 열었다. 아래의 ‘보인다/겹치지 않는다’는 정지 이미지 관찰이며 버튼 동작이나 실제 경기 성공 추정이 아니다. 모든 파일은 full-page 캡처이므로 PNG 높이가 viewport 높이보다 길 수 있다.

| 직접 열어 본 파일 | 실제 시각 관찰 | 남은 한계 |
|---|---|---|
| [로그인1366](evidence/after-login-1366x768.png) | 로그인/공개 플레이 선택과 guest 버튼이 가려지지 않는다. ‘이용할 수 있습니다’, ‘홈’ 표현을 사용한다. 하단 소개에서 8개 기술 이름과 접힌 summary를 확인했다. | 우측 문장의 ‘있습니 / 다.’처럼 한 글자가 다음 줄로 내려가는 한국어 줄바꿈이 있다. 버튼 actionability는 이미지가 아닌 위 브라우저 기록의 범위로 판단한다. |
| [Home1366](evidence/after-home-1366x768.png) | 세 CTA가 첫768px 안에 있고, 소개는 card와 서비스/도움말 뒤에 있다. 로컬 각 키의 위로/아래로 역할, AI의 컴퓨터 상대 및 난이도 안내, 온라인 규칙 설명을 읽을 수 있다. 계정 제목과 rail이 겹치지 않는다. | rail의 Home은 ‘홈’으로 바뀌었지만 2FA는 기존 이름을 유지한다. 첫 제안의 모든 메뉴 번역이 적용됐다고 확대하지 않는다. |
| [공개 허브1366](evidence/after-play-hub-1366x768.png) | Home과 같은 card·키 설명·기술 소개를 사용한다. 로그인 없는 로컬/AI와 ‘로그인하고 대전’ 버튼을 구분하며 세 CTA가 첫768px 안에 있다. | 익명 경로가 실제로 서버 없이 경기를 끝냈다는 기능 검증은 이 이미지에 없다. |
| [온라인 로비1366](evidence/after-online-lobby-1366x768.png) | ‘홈으로’, 위로/아래로/Power 키, 쉬운 focus 설명, 충전량이 한 칸씩 줄어든다는 Power 문구를 확인했다. 코트와 상대 찾기 버튼이 가려지지 않는다. 하단 랜덤 규칙 설명과 control은 현재 폭에서 겹치지 않는다. | ‘연결 상태 자세히 보기’는 접혀 있어 내부 수치/설명의 시각 배치는 이 PNG에서 검토하지 않았다. 하단 긴 규칙 문장은 조밀하게 배치되어 있다. |
| [로그인 CSS200%](evidence/after-login-details-css-200percent.png) | 로그인 주요 영역과 펼친 소개가 문서 흐름을 따라 이어진다. 기술 이름은 여러 줄로, 설명은 소제목별로 읽힌다. summary의 focus outline과 공개 선택 링크가 잘리지 않는다. | 일부 한국어 단어가 글자 단위로 나뉜다. 전체 페이지의 세로 길이 증가를 가로 넘침이나 native 확대 검증으로 오해하지 않는다. |
| [Home CSS200%](evidence/after-home-details-css-200percent.png) | card는 두 열과 다음 행으로 재배치되며 버튼·키·난이도 control이 card 내부에 있다. 8개 기술명과 확장 설명, 팀 프로젝트 기여 문구가 읽히고 영역끼리 겹치지 않는다. | Classic 설명의 ‘승리합니 / 다.’, 로컬 설명의 단어 분할이 보인다. 고정 rail의 모든 링크에 실제 도달했는지는 이 긴 정지 이미지로 검사하지 않았다. |
| [공개 허브 CSS200%](evidence/after-play-hub-details-css-200percent.png) | 두 열 card와 다음 행 온라인 card, 여러 줄 기술명, 펼친 설명이 잘림 없이 배치된다. 주요 CTA/summary와 본문이 겹치지 않는다. | native browser 확대나 터치 경기 지원은 검증 범위가 아니다. |

1366 PNG의 실제 높이는 Login 967, Home/공개 허브1128, 온라인 로비868이다. CSS200% PNG는 폭1440이고 높이는 Login3375, Home4410, 공개 허브4269이다. 변경 전후 비교 기준 viewport는 계속 1366×768이며 전체 이미지 높이가 달라진 것은 하단 소개와 문서 내용 증가를 포함한다. 1440·390·일반 확대 details의 다른 이미지 검토는 root 담당으로, 이 작성자의 직접 열람 목록에 더하지 않는다.

### root 소유 P4 소스에서 확인한 적용과 역사 제안의 차이

이번에 다시 읽은 [LoginView](../../frontend/src/views/LoginView.vue)는 공통 ProjectInfo를 실제 연결하고 로그인 문장을 정리했다. 취소 링크는 최초 제안의 ‘로그인 없이 플레이하기’ 대신 **‘플레이 방식 다시 선택’**을 사용한다. 실제 `/play` 이동과 의도 정리 handler를 유지한 문구 선택이다. [SideBar](../../frontend/src/components/SideBar.vue)는 ‘홈’을 적용했으며 기존 2FA 이름까지 전부 번역하지 않았다.

[OnlineGameShell](../../frontend/src/components/game/OnlineGameShell.vue)은 위로/아래로/Power 역할, 충전량 감소, ‘연결 상태 자세히 보기’와 RTT/입력 확인/보관 상태 수/보간 부족 구간 설명을 적용했다. [LocalPlayView](../../frontend/src/views/LocalPlayView.vue)의 조작 역할과 Power 충전량 문구, [GameView](../../frontend/src/views/GameView.vue)의 랜덤 규칙, [InviteGameView](../../frontend/src/views/InviteGameView.vue)의 초대자 규칙도 소스로 확인했다. [online-result](../../frontend/src/arcade/online-result.ts)의 pending 문구는 ‘전적 저장 여부를 확인하지 못했습니다’로 바뀌어 실패 확정과 구분한다. 이 문서가 해당 모든 상태를 실제로 발생시켜 보았다는 뜻은 아니다. Spectate 등의 최초 제안도 일괄 적용으로 간주하지 않는다.

검토 의견은 **주요 CTA·소개·summary의 시각 겹침 또는 잘림을 발견하지 못함**, **한국어 일부 단어/한 글자 줄바꿈은 경미한 가독성 개선 후보**다. 후자는 root에 전달했으며 scoped prose의 `word-break: keep-all` 등을 제안했지만, 이 리뷰를 위해 생산 소스를 추가 변경하지 않았다. 기술 설명은 구현 근거와 맞고 온라인 지연 감소·AI 학습·단독 팀 기여를 주장하지 않는다.

현재 상태: **P3 소스 적용 / 소유 타입·lint exit0 / root 브라우저 단언69개 true / baseline4장과 수정 후7장 실제 열람**. 이 범위의 문구·소개 검토를 운영 LNA 해결 완료, native 권한 UI 확인 또는 온라인 경기 완료로 보고하지 않는다.


## 최종 CSS 후속 검토 — `final-css-v2`

root가 앞 검토 의견 중 한국어 어미 한 글자 분할을 수용해 [LoginView](../../frontend/src/views/LoginView.vue)의 `.login-page p`, [launch.css](../../frontend/src/arcade/launch.css)의 `.launch-rules > p`, [ProjectInfo](../../frontend/src/components/arcade/ProjectInfo.vue)의 `.project-info p`에만 `word-break: keep-all; overflow-wrap: anywhere`를 적용했다. 이 후속 변경은 문구·인증·경기 JavaScript 또는 프로토콜을 변경하지 않는 CSS 조정이다. 이 작성자는 해당 생산 파일을 수정하지 않고 소스와 새 이미지만 읽었다. 앞의 최초 after23개 PNG 및 당시 줄바꿈 관찰은 그대로 보존한다.

새 실행은 root 소유 fixture `http://127.0.0.1:52957`, build `3d03e7e0daad7476`이다. [최종 CSS 브라우저 JSON](evidence/final-css-v2/after-copy-browser.json)은 `2026-09-08T19:48:37.448514+00:00`, Chrome `152.0.7977.77`, index SHA-256 `f168717e4c47034a74243bbd68e38467112c107f5ff64b6af358904eb197e570`을 기록한다. 원시 JSON을 이 작성자가 다시 계산해 **69/69 단언 true·pageErrors0·guestTransport=document**를 확인했다. 전체 record 상태는 `CAPTURED`다. 이전69개와 같은 시험을 새 CSS에서 재실행한 것으로, 서로 다른138개 기능 시험으로 합산하지 않는다. 명령의 실제 실행·process exit 보고는 root 실행 기록의 소유 범위다.

### 새 파일을 직접 열어 확인한 7장

| 직접 열어 본 최종 CSS 이미지 | 변경 전 지적에 대한 후속 관찰 |
|---|---|
| [로그인1366](evidence/final-css-v2/after-login-1366x768.png) | 우측의 ‘있습니 / 다.’가 없어지고 ‘있습니다.’가 한 단어로 다음 줄에 놓인다. guest 버튼과 공개 선택·취소 링크의 배치가 유지되며 새 겹침은 보이지 않는다. 하단8개 기술명은 접기 밖에 있다. |
| [Home1366](evidence/final-css-v2/after-home-1366x768.png) | 규칙 설명·세 모드 CTA·키 역할·계정 제목·서비스 안내가 기존 영역에 유지된다. 세 CTA는 첫768px 안에 있고 하단 소개가 앞쪽 버튼을 밀어내지 않는다. |
| [공개 허브1366](evidence/final-css-v2/after-play-hub-1366x768.png) | 세 CTA가 첫768px 안에 유지되며 키/난이도와 소개가 겹치지 않는다. 핵심8개 기술 이름을 계속 접기 밖에서 읽을 수 있다. |
| [온라인 로비1366](evidence/final-css-v2/after-online-lobby-1366x768.png) | 코트/상대 찾기/규칙 select/키 안내와 접힌 진단 summary가 이전 배치를 유지한다. CSS 조정으로 새 가림이나 잘림은 보이지 않는다. |
| [로그인 CSS200%](evidence/final-css-v2/after-login-details-css-200percent.png) | ‘선택할 수 있습니다’, ‘이용할 수 있습니다’와 소개 본문이 단어 단위로 줄바꿈되어 어미 분할이 개선됐다. summary focus outline·기술 chips·본문 소제목과 링크가 잘리지 않는다. |
| [Home CSS200%](evidence/final-css-v2/after-home-details-css-200percent.png) | 규칙의 ‘승리합니 / 다.’가 ‘승리합니다.’로 개선됐다. 소개 문단도 단어 단위로 줄을 바꾸며 카드/버튼과 기술 소개가 겹치지 않는다. 기존 두 열 및 다음 행 온라인 카드 배치를 유지한다. |
| [공개 허브 CSS200%](evidence/final-css-v2/after-play-hub-details-css-200percent.png) | 기술 소개의 단어 분할이 개선됐고, 8개 기술 이름과 expanded summary focus를 읽을 수 있다. 세 card 및 기술 설명이 문서 흐름 안에 있고 새 가로 잘림은 보이지 않는다. |

7개 파일을 `view_image`로 모두 직접 열었으며 CSS 확대3개는 원본 해상도로 열었다. 새1366 PNG 높이는 Login967, Home/공개 허브1128, 온라인868이고, CSS200% PNG(폭1440)는 Login3419, Home4410, 공개 허브4269다. Login 확대의44px 세로 증가를 가로 overflow로 해석하지 않는다. 다른 기본1440/390·diagnostics·AI 이미지와 일반 expanded details 이미지의 별도 담당자 검토는 이 작성자의 직접 열람 수에 넣지 않는다.

수용한 CSS 변경에 대한 판정은 **지적한 Login·규칙 설명·ProjectInfo의 줄바꿈 개선 확인, 새 겹침·가로 잘림 미발견**이다. 이번 좁은 CSS 범위 밖인 Home 확대 card 본문에는 ‘대결합 / 니다.’, 온라인 안내에는 ‘규칙으 / 로’와 같은 글자 단위 분할이 일부 남는다. 읽을 수 있는 내용이며 버튼을 가리거나 기능 동작을 막는 문제로 판정하지 않았다. 모든 한국어 본문의 단어 분할을 없앴다고 보고하지 않는다.

이 후속 검토에서도 브라우저 새 실행·클릭·경기·빌드는 수행하지 않았다. 정지 이미지에서 기능 PASS를 추정하지 않고, 앞서 명시한 **CSS 200%와 native Chrome 확대의 차이, 기술명 자동 단언6종과 실제 열람8종의 차이, 운영 LNA/실제 온라인 경기 완료 검증 제외**를 유지한다. 현시점 이 작성자의 직접 열람은 baseline4장·최초 after7장·최종 CSS7장으로 구분한다.
