# Home / online 후속 개선 — 구현 기록

요청 명세: `/Users/sm/Downloads/ft_transcendence_home_online_codex_goal_20260908.md` 전체. 판정은 **READY_FOR_REVIEW**다. Home·공개 허브와 동선 구현/검증, 온라인 복구·보간·효과 구현 및 격리된 실제 서버/Chrome 검증을 완료했다. 운영 배포·사람의 실제 플레이/청취는 검증하지 않았다. 이전 `docs/arcade-upgrade`는 변경하지 않는 역사 기록이다.

## 읽기 전용 gate (2026-09-08)

- 정확한 origin: https://github.com/sungmpar/ft_transcendence_project. main / HEAD·origin/main `2f11bee69c2d55ed938b53f9750119a890396fb7`. `git fetch origin main` exit 0. merge/rebase/reset/branch 이동 없음.
- mutation 전 `git status --porcelain=v1 --untracked-files=all`, `git diff --stat`, `git diff --cached --stat`: 출력 없음. worktree 한 개, 같은 main/HEAD. `.git` 아래 lock 파일 없음.
- 앱에 관찰 가능한 이 저장소의 활성 작업은 현재 Goal 하나. 다른 저장소 작업을 읽거나 수정하지 않았다. 이것은 관찰 불가능한 외부 작업 부재 보장이 아니다.
- GitHub live 조회 00:50:12–00:52:00 UTC: [repository](https://api.github.com/repos/sungmpar/ft_transcendence_project), [main](https://api.github.com/repos/sungmpar/ft_transcendence_project/branches/main), branches?per_page=100&page=1·2 → main 1개 / 0개; issues?state=open&per_page=100&page=1·2 → 각 0개; pulls 같은 옵션 page1·2 → 각 0개. archived/disabled false.
- 행동·심볼 의미 검색: Home/launch/local/AI/online/invite; destination/reconnect/spectator/snapshot/audio/login; SnapshotBuffer/ServerMatchRunner/publicArcade/AudioFeedback/guideItems/gameSteps; addUser/dropUser/spectate/releaseRoom/GameplayService/OnlineSession. 각 묶음을 open issue/PR로 검색한 8쿼리 모두 total_count=0, incomplete_results=false. 초기 쿼리 문법 오류 422는 유형/OR 제한을 수정한 후 성공했다.
- 직접 중복 / 의미상 대체 / 단순 인접 활성 작업: 관찰 없음. 관련 issue 세부 가용성·timeline·claim·linked PR 및 plausible PR changed-file·diff는 **N/A: 대상 없음**, 조회 불가를 성공으로 바꾸지 않음.
- README/manifests/lock/config/source/tests 확인. 저장소 CONTRIBUTING.md/추가 AGENTS.md 없음. 사용자 제공 AGENTS 규칙 적용. Vue Router 설치/lock 4.1.3, Socket.IO 4.5.1, Node 작업 runtime 18.20.8, Python Playwright 1.55.0, 실제 Chrome152.0.7977.77, 임시 PostgreSQL14.23 확인. `rg` 명령 없음은 find/grep 대체. origin/HEAD symbolic ref 없음은 live API 기본 main 확인으로 보완.
- 현재 코드 H01/H02/H03/H06/H07/N1/N2/N3/N4 후보 확인, 기존 고정 Jest와 격리 Socket/DB/브라우저 fixture로 회귀 가능. H08은 설치 Router4.1.3이 params를 보존하므로 실패 미확정. 자동 수정하지 않는다.
- 위 확인 후 Phase A/B GO. 서버·공유 프로토콜 변경 전과 효과 단계 전에 live/ownership을 다시 확인했다(아래 기록).

## 변경 전 실제 화면

기존 fixture만 사용, 운영 env/AppModule/DB를 로드하지 않음. loopback PostgreSQL55432, HTTP59707. 실제 `/auth/guest` 전체 페이지 이동으로 Home 로그인. 게임 상태/인증 응답 mock 없음. `evidence/before-screen-report.json` 및 before PNG. 현재 소스와 동일한 기존 build 실행; fresh baseline build hash `705af758a21aa3ca`도 최초 실행 dist와 일치했다.

Home1440×900/1366×768/1024×768/390×844, Login/PlayHub/online lobby1440×900 캡처. Home desktop/mobile 이미지를 실제 열어 검사. 본문 local/AI CTA 각0. 모바일 rail이 본문 일부를 덮음(단순 scrollWidth 측정만으로 잡히지 않음). 강한 보라 배너/설명9개가 우선순위를 차지. 계정은 일회용 fixture guest이며 개인정보/운영 데이터가 아니다.

## Phase B — 실제 Home와 진입

- Home의 설명9개/강한 배너/튀는 로고를 제거하고 `LaunchPanel.vue`로 로컬2인·AI·온라인 행동을 먼저 보여준다. Home과 공개허브는 동일한 작은 규칙/모드/도움말 컴포넌트를 쓰며 API 데이터는 공유하지 않는다.
- 실제 preferences의 Classic/Normal/키 재지정 값을 카드에 표시한다. Home 규칙 선택은 명시적으로 로컬·AI 범위이며 온라인은 기존 서버 합의가 최종 권한이다. 공개 온라인/관전/초대는 허용한 로그인 intent로 연결한다.
- App 80px rail을 shrink하지 않게 분리, 나머지 콘텐츠 min-width:0. Sidebar 메뉴는 native 링크·버튼과 텍스트 이름, 자체 scroll. Login은 auth 경계를 바꾸지 않고 독립 레이아웃만 적용한다.
- Home 계정 disclosure는 Escape·focus 복귀/아바타 이니셜 fallback. 친구 drawer는 실제 요청 loading/empty/error/취소 구분. 세 online route는 자기 socket을 mount 후 연결하고 자신의 canvas/socket만 정리한다. 이전 route의 dispose가 새 경기 세션을 파괴하는 경우의 회귀를 추가했다.
- H06 baseline 실제 public온라인→guest전체이동→Home을 재현(`baseline-login-return.json`). 안전한 sessionStorage intent 허용3경로/TTL10분/singleuse/취소·로그아웃 삭제로 수정. 인증 완료/닉네임/2FA guard를 우회하지 않는다.
- H08은 pinned Router4.1.3의 params가 실제 친구 UI→초대 대상에 전달되어 기존 계약 유지. baseline 친구UI 독립 재현은 build와 겹친 실패로 미확정이며, 변경 후 실제 전달 성공만 보고한다.
- 본문 Home과 hub에 자동 경기진행/자동매칭/장식용 소켓·RAF 없음. 실제 CTA/explicit Start로만 진행.
- `browser-home-visual.py` 실행 exit0, 최종 48 checks PASS: Home4viewport, desktopCTA첫viewport, 모바일계정/Escape, AI Power/Hard/right키 전달·시작, local진입, online로비자동매칭없음, 친구Escape포커스, brokenavatar, 200%zoom, runtime오류0, fresh static공개3경로auth/socket요청0. 첫 attempt는 HeadlessUI 외곽의 0크기 wrapper를 visible 대상으로 고른 시험 selector 오류였으며 실제 panel로 바로잡고 최초로그 보존. 제품실패를 지운 것이 아니다.
- 전후 Home desktop/mobile, after1024/Home200%/Login/PlayHub/online로비 이미지 실제열기검토. 본문겹침해소, 동일규격CTA정렬, 한국어줄바꿈과대조 확인. 사람의체감이나모든브라우저 검증 주장은 하지 않음.
- unit Phase B는 9 configs 모두 exit 0 (기존136 + navigation21 + lifecycle1 = 158 tests). 전체 baseline lint부채는 유지; Home/App/LaunchPanel 신규 lint 0error. defineProps macro import 누락 lint1건을 명시import로 수정한 뒤 통과.

## Phase C 전 재게이트

단계 E에서 build `4de1388331743be3`·fixture52262로 Home 그룹 3명령을 재실행해 모두 exit0을 확인했다. 화면48/인증18/내비게이션4 PASS와 별도 관찰1을 기록했다. 연결 보완 뒤 최종 build `99110685ef45f988`에서도 Home48과 내비게이션4 PASS/관찰1을 각각 exit0으로 다시 확인하고 새 PNG9장을 직접 열었다. Login 소스가 바뀌지 않은 인증18 검사는 재실행하지 않았으며, 최신 browser 그룹의 guest8/선행인증3 PASS와 구분한다. 같은 계정 전후 캡처는 덮어쓰지 않았다.

2026-09-08 01:11:30 UTC: GitHub main2f11bee 동일, openissues/PR 각 per_page100 page1=[]로 열거종료. 관련 diff 대상 없음(N/A). gitfetch exit0, HEAD/originmain 동일, 단일worktree/main, lock없음. dirty는 이 Goal의 root/navigation/테스트 담당이 만든 명시적 파일만 확인. 서버·프로토콜은 아직 수정하지 않음. Phase B의 최종 auth/관전목록 검증 뒤 C 구현을 시작한다.


## 추가로 확인한 Home 문제와 수정

독립 에이전트 리뷰는 두 P2를 실제 브라우저에서 재현했다. 게스트 endpoint의 503이 원시 오류 문서로 이동해 공개 플레이 대안을 없앴고, `/spectate`에서 온 로그인 화면의 새 탭 링크가 sessionStorage 목적지를 전달하지 못했다. 리뷰 원문과 최초 증거는 `INDEPENDENT_HOME_REVIEW.md`에 보존한다.

Login은 단일 guest 요청에서 기존 쿠키를 받고, 수동 redirect 응답 뒤 고정된 `/login?token=check`로 전체 페이지 이동한다. 실제 인증·닉네임·2FA guard는 그대로 수행한다. 오류·timeout이면 Login의 로컬/AI 링크를 유지하며, 진행 중 공개 경로로 이동하면 요청을 취소하고 늦은 callback 이동을 막는다. 새 탭은 검증된 세 목적지 중 하나만 `next`로 전달한다.

별도 frontend/backend 포트의 CORS는 실제 두 origin/Chrome probe로 확인했다. 기본 wildcard credential fetch와 redirect-follow는 실패했다. `/auth/guest` 응답에만 설정된 `FRONT_URL`과 정확히 일치하는 Origin의 credential CORS를 허용하고 manual redirect를 사용한다. 다른 API의 CORS, OAuth, 인증 권한은 넓히지 않는다. 실제 DB/JWT 전체 경로의 최종 재시험은 별도 테스트 기록에 남긴다.

## 로컬/AI 보존 확인

기존 실제 Chrome 회귀 25개에 더해 `browser-local-modes.py`의 31개 검사가 통과했다. 실제 키 입력으로 로컬 Power의 유효 반사 5회 충전과 발동을 확인하고 6점까지 완주했다. AI는 Classic/Power × Easy/Normal/Hard 여섯 조합에서 지연 관찰, 6점 종료, 재시작, 메뉴 이탈 후 세션 해제를 확인했다. 이들은 브라우저 자동 키 입력과 가속 시계이며 사람의 물리 키보드 플레이가 아니다. 서비스/외부 요청과 페이지 오류는 0이었다. Power 활성·AI 종료 캡처를 실제로 열어 확인했다.

## 온라인 발견 사항 — 현재 단계

- N1: 실제 두 게스트의 경기에서 유예 만료 후 같은 페이지가 전체 상태 대기에 남는 현상을 재현했다. 새 요청 식별자/경기 식별자를 가진 `sessionSync`는 인증 참가 권한으로 진행·대기·저장 중·재시도·저장됨·실패·없음·조회 실패를 구별한다. `matchEnded`는 경기 ID로 과거 종료를 거른다. 재접속 페이지의 실제 결과 표시와 재매칭을 브라우저에서 확인했다. 서버의 5초 유예와 브라우저/transport가 단절을 감지하기까지 걸린 시간은 분리해 기록한다.
- N2: 플레이어 연결은 유지하고 관전자 자신의 WebSocket만 끊었을 때 재접속 후 tick이 진행하지 않는 결함을 실제로 재현했다. 현재는 요청 식별자와 인증된 관전 이력으로 재구독한다. 실제 관전자 단독 복귀와 입력 0을 확인했다. 통합 실행의 별도 실패·재시험 결과는 TEST_REPORT에 구분한다. 종료된 경기의 결과 조회는 이전 관전 권한이 필요하며 서버 재시작 후 권한 이력이 없으면 복원 불가를 알린다.
- N3: 실제 runner와 buffer를 연결한 시험은 정상 60Hz/20Hz·±40ms 지터·200ms stall을 통과했고 500/1000ms stall·반복 stall·pause/resume에서 실패했다. 구현 전에 정한 기준은 재개 후 300ms 안에 실제 두 새 스냅샷 사이의 tick과 움직이는 좌표를 표시하는 것이다. latest 상태가 움직이거나 underflow 횟수가 고정된 사실만으로 통과시키지 않는다.
- N3 수정: 서버 실행 인스턴스와 presentation clock epoch를 명시했다. 실제 시간이 폐기되거나 의도적으로 정지했다 재개하면 epoch를 바꾸고, 클라이언트는 이 명시적 경계에서만 보간 기준을 다시 잡는다. 정상 지터의 최솟값 offset과 시간 단조성은 유지한다. 고정 기준 시험에서 stall 회복 155ms, pause/resume 205ms; 확장 8개 모두 PASS다. 이는 가짜 시계의 결정적 결합 시험이며 WAN 측정이 아니다. 독립 리뷰가 찾은 부적합 ACK의 복구 타이머 취소도 red 시험 후 수정했다. [N3 기록](N3_CLOCK_REPORT.md), [독립 검토](INDEPENDENT_ONLINE_REVIEW.md).
- 온라인 효과/음향 구현과 결정적 시험, 단계 E의 실제 서버/Chrome 통합 검증을 완료했다. Home 완료, 격리된 온라인 검증 완료, 운영·실제 사람 검증 미실행을 구분한다.

2026-09-08 01:47 UTC live 재확인: main은 같은 `2f11bee`, open issue/PR 첫 100개 페이지가 각각 빈 배열이었다. 관련 diff 대상은 계속 N/A였다.

2026-09-08 단계 D 직전 재확인: live main은 같은 `2f11bee`, open issue/PR 각각 0이며 관련 diff는 N/A. `git fetch origin`, `git diff --check`, `git worktree list --porcelain` 모두 exit 0. 단일 main worktree와 이 Goal 소유의 dirty 변경을 보존했다.

## 서비스 화면에서 추가로 재현한 배치 문제

독립 브라우저 검토에서 모바일 Chat 입력 폭0, Info의 Logout wrapper가 Main 클릭을 가로채는 문제가 드러났다. 새 App의 콘텐츠 폭/containing block과 기존 absolute/fixed-width 요소의 상호작용을 보완했다. Chat의 pane·입력 폭, Info/Tfa의 정상 문서 흐름·footer·파일 입력 폭만 조정했고 실제 메시지/인증 핸들러를 바꾸지 않았다. 첫 보완 후 동일 viewport에서 28개 동작 검사가 통과했지만, 직접 연 캡처에는 과도한 Send 폭과 Board 표의 문서 가로 넘침이 남았다. 입력과 Send의 flex 비율, 표 전용 스크롤 영역과 좁은 화면 헤더를 추가 보완했으며 최종 같은 viewport의 37개 검사가 통과했고 root와 독립 reviewer가 캡처를 직접 열었다. Chat의 입력/Send 폭, Info/Tfa의 실제 Main 복귀, Board의 자체 가로 스크롤·키보드 우측 열 접근을 확인했다. Board의 기존 조밀한 열 타이포그래피와 데이터 표 구조는 유지하며 전체 서비스 디자인 개편으로 표현하지 않는다. baseline 서비스 화면은 재실행하지 않았으므로 기존 소스라는 이유만으로 이번 레이아웃과 무관하다고 단정하지 않는다.

## 단계 D — 서버 이벤트와 공통 피드백

서버 runner는 매 tick의 실제 GameEvent를 모아 최근 120tick·최대 64개의 이력으로 보낸다. 개별 관전자의 full ready는 공통 이력을 소비하거나 20Hz 송신 시점을 미루지 않는다. 경기·실행 인스턴스·clock epoch와 이벤트 ID를 함께 사용하고 full ready의 cursor 이전 효과는 재생하지 않는다.

클라이언트는 검증·buffer 수용을 통과한 서버 이벤트를 presentation tick까지 기다렸다가 표시한다. 6tick보다 늦은 효과는 건너뛴다. 점수·서브·재동기화·연결 대기 경계에서 이전 trail/flash/audio를 정리한다. 즉시 종료 화면은 실제 서버 최종 상태로 snap하며, 그 최종 tick의 실제 point/finished만 한 번 표시할 수 있다. 기권에서 득점 이벤트를 만들지 않는다. 이는 중복 억제와 제한된 누락 허용 정책이며 네트워크 exactly-once 전달 보장이 아니다.

온라인 route의 Shell이 AudioFeedback을 소유한다. 저장된 켬 설정만으로 AudioContext를 생성·resume하지 않고 native 버튼/경기 조작을 기다린다. 차단/미지원 상태가 보이며 음소거·이탈·새 세션에서 음원 노드를 정리한다. 같은 tick의 음은 종료/득점/Power/타격 우선순위로 하나를 선택하고 활성 음원도 제한한다. 온라인 키는 기존 세 키의 두 preset을 따로 저장하며 로컬의 여섯 키 설정을 바꾸지 않는다. 모션은 시스템 또는 명시적 감소를 따른다.

독립 리뷰의 기존 running context 재사용과 단절 순간 타격 flash 잔류는 각각 실패 시험 후 수정했다. 이벤트/오디오/설정 18개와 단계 D 전체 단위225개가 통과했다. 연결 보완 8개를 포함한 최종 단위는233개다. 실제 청취와 브라우저 실제 이벤트 검증은 서로 다르며 최종 결과는 TEST_REPORT에 기록한다.

## 단계 E — 연결 충돌 보완과 검증의 구분

서버가 중복 탭을 거부한 뒤 화면에 이유가 사라지고 6초 동안 연결을 5회 더 만드는 동작을 실제로 재현했다. 소스만 읽고 예상한 namespace DISCONNECT/자동 복구 중단과 달리 실제 wire는 transport close였으며, 기존 탭을 닫으면 수정 전에도 자동 복귀했다. 이 반증을 보존하고 원인을 반복 시도·안내 소실로 좁혔다. 최초 관전자 통합 실패의 원인이 같은 문제였다고 추론하지 않는다.

`connection-retry.ts`와 기존 세 온라인 화면은 서버의 정확한 활성 접속 충돌 응답에서만 자신의 반복 연결을 멈추고 이유를 유지한다. 사용자의 `연결 다시 확인`은 5초 제한·중복 클릭 방지·늦은 이벤트와 dispose 정리를 갖는다. 일반 단절 자동 재접속, 원래 탭의 서버 권한, 실제 경기 조회는 유지한다. 실제 `/game`, `/invite`, `/spectate`에서 기존 탭 보호·6초 추가 연결0·기존 탭 종료 후 native 버튼1회로 같은 페이지 새 연결·idle 입력0을 확인했다. [연결 기록](E_CONNECTION_RETRY_REPORT.md).

최종 browser wrapper의 실패를 지우지 않았다. 첫 실행은 관전자 새 transport가 열리지 않았고 원인은 미확정이다. 최신991 실행은 앞4 configs13 PASS 뒤 P4의 context offline만으로 상대 일시정지를 관측하는 조건에서 실패했다. P4는 실제 현재 WebSocket을 닫고 재시도 장애 구간을 제어하는 시험으로 보완했으며 경기 패킷·점수·서버 상태는 바꾸지 않았다. 추가 observer의 namespace 파싱 오류도 한 차례 실패한 뒤 수정했다. 최종 P4는 같은 tick317을 200ms 유지, 새 generation/같은 경기·편, 상대 재개, 활성 탭 보호, 실제 기권 결과를 PASS했다. 이 실행에서는 제어 구간에 새 연결 시도가 없어 차단 분기 자체의 실행을 주장하지 않는다.

live 재확인은 2026-09-08 04:24:32 UTC와 최종 전달 직전에 반복했으며 main SHA는 동일하고 open issue/PR은 각각0이다. 허용된 `git fetch origin`과 diff check는 exit0, 단일 worktree/main·staged0·기존 코어/lockfile/이전 문서의 변경0을 확인했다. 마지막 04:38:16 UTC runtime 기록은 두 데모 주소의 HTTP200도 포함한다. 자세한 기록은 `final-live-gate-before-packet.json`, `final-delivery-live-gate.json`, `final-delivery-runtime-state.json`이다.

최종991 온라인3시나리오는 실제6점 종료·재매칭·DB 저장, 관전자 단독 복귀/입력0, 서버 타격·브라우저 오디오·키·모션·자원 해제를170.514초 exit0으로 통과했다. 담당자가5개 최종 PNG, root가 결과·관전·효과3개를 직접 열었다. 단위233/실제 서비스15/최신 browser 각 config합15/Home48·인증18·메뉴4/서비스화면37/로컬56의 단위와 빌드별 실행 경계는 TEST_REPORT가 기준이다. 전체6개 browser wrapper exit0은 주장하지 않는다. 신규 소스 줄의 lint 진단은0이지만 전체 lint는 baseline 부채로 여전히 exit1이다.

## 기여와 검증의 경계

원래 팀의 로그인·2FA·채팅·친구·전적·서비스 구조 위에서 작업했다. 기존 개인/AI 보조 개편의 공통 코어·로컬/AI·온라인은 현재 공개 baseline에 이미 포함된 기능이다. 이번 미커밋 변경은 Home와 진입·복귀·온라인 복구·표시 경험의 후속 개선이다. 과거 기여를 이번 성과로 재집계하지 않는다. 독립 에이전트의 검토는 사람의 외부 리뷰가 아니며, 브라우저 자동 시험도 사람의 체감·청취·물리 키 입력·WAN·운영 배포 검증을 대신하지 않는다.
