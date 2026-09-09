# 독립 검토 입구

대상 `sungmpar/ft_transcendence_project`, 기준 `main/ecbb0ee30694f372b8e6e51c1642ef258681443d`. commit/push/PR/comment/운영 변경 없이 로컬 작업 트리에 남긴 변경이다. 기존 두 개편의 기록은 그대로 보존했다.

1. [기준과 수정 범위](BASELINE_AND_SCOPE.md), [최신 의미상 중복 gate](evidence/final-gate.json)
2. [실제 공개 Request URL·Initiator와 원인 한계](DIAGNOSIS.md)
3. [guest 문서 이동·cookie·intent·bfcache 계약](P1_AUTH_CONTRACT.md)
4. [설치 버전 HMR 주소·실제 프록시·초기 연결 실패와 자동 재연결](P2_HMR_REVIEW.md)
5. [한국어 문구 전후·기술별 코드 근거·화면 검토](COPY_REVIEW.md)
6. [이번 실제 명령·성공·실패·미실행](TEST_REPORT.md), [독립 에이전트 읽기 리뷰](INDEPENDENT_REVIEW.md)
7. [원본 관전자 실패와 계측 후속 시험](OBSERVER_DIAGNOSIS.md)
8. [운영 배포 담당자에게 필요한 최소 확인](DEPLOYMENT_HANDOFF.md)

## 이번 결과와 해석 범위

게스트 로그인은 기존 전체 문서 이동으로 복원했다. HMR은 브라우저 origin을 기본 목적지로 사용한다. Home·공개 허브·로그인에는 정적 기술 소개를 추가하고 실제 규칙·입력·인증 상태에 맞춰 문구를 정비했다. 공통 코어·AI·서버/로컬 runner·게임/채팅 프로토콜은 변경하지 않았다.

실제 공개 페이지에서 잘못된 사설 HMR URL과 생성 stack을 확인했다. native LNA 권한창 직접 관찰은 도구 접근 불가로 BLOCKED이고, 운영 로그인과 수정 배포 검증은 NOT_RUN이다. 로컬 fixture 결과를 운영 해결로 바꾸지 않는다. 온라인 전체 브라우저 묶음의 최초 관전자 timeout과 후속 개별 시험 결과는 TEST_REPORT에 함께 남겼다.

전후 화면은 같은 1440×900, 1366×768, 390×844 viewport다. [수정 전 Home](evidence/before-home-1440x900.png), [최종 Home](evidence/final-css-v2/after-home-1440x900.png), [공개 허브](evidence/final-css-v2/after-play-hub-390x844.png), [로그인](evidence/final-css-v2/after-login-1440x900.png)을 바로 비교할 수 있다. 전12/최종 후23 PNG 모두 팀 에이전트가 실제 열어 검토했다.

## 검토할 코드

- 인증: [LoginView](../../frontend/src/views/LoginView.vue), [guest URL 검증](../../frontend/src/arcade/guest-navigation-url.ts), [AuthController](../../backend/src/auth/auth.controller.ts). guest 전용 fetch/CORS 제거와 다른 인증 검사 보존을 대조한다.
- HMR: [vue.config.js](../../frontend/vue.config.js). 명시 override·allowedHosts를 보존하고 기본값만 browser origin으로 바꿨는지 확인한다.
- 소개·문구: [ProjectInfo](../../frontend/src/components/arcade/ProjectInfo.vue), [LaunchPanel](../../frontend/src/components/arcade/LaunchPanel.vue), [Home](../../frontend/src/views/HomeView.vue), [공개 허브](../../frontend/src/views/PlayHubView.vue), [LocalPlay](../../frontend/src/views/LocalPlayView.vue), [온라인 공통 화면](../../frontend/src/components/game/OnlineGameShell.vue), [온라인 결과 안내](../../frontend/src/arcade/online-result.ts).
- 재현 입구: [check-arcade.cjs](../../scripts/check-arcade.cjs), [동일 viewport 문구 검사](../../scripts/browser-compat-copy.py), [guest 브라우저 계약](../../backend/test/home-guest-entry.e2e-spec.ts).

[변경 전](evidence/baseline-source-hashes.json)과 [변경 후](evidence/after-source-hashes.json) 해시로 보존 범위를 확인한다. Node modules, 운영 env, credentials, 브라우저 프로필, DB 디렉터리는 이 패킷에 넣지 않았다. 정제된 loopback fixture 증거를 운영 검증으로 해석하지 않는다. 독립 리뷰는 같은 도구 환경의 다른 에이전트가 수행했으며 인간 리뷰가 아니다.

## 실행

이번 세션의 최종 정적 결과는 http://127.0.0.1:52431/play 에서 볼 수 있다. [빌드와 HTTP 응답 해시](evidence/final-preview.json)가 일치한다. 소유한 화면·온라인 시험 fixture는 종료했고, 아래 명령으로 새 로컬 서버를 실행할 수 있다.

설치된 고정 의존성을 사용한다. 새 환경의 설치 조건과 Node/DB/브라우저 경로는 [README](../../README.md) 및 TEST_REPORT를 확인한다.

```sh
cd frontend
yarn serve
# http://localhost:3000/play
```

로컬 2인·AI는 백엔드·로그인 없이 플레이한다. 온라인은 README의 소유한 격리 fixture 실행 절차와 같은 변경 버전의 frontend/backend를 사용한다. 운영 서버나 운영 DB로 시험 명령을 바꿔 실행하지 않는다.
