# ft_transcendence · Arcade upgrade

기존 팀 Vue/TypeScript·Nest/Socket.IO 프로젝트에 같은 경기 코어를 사용하는 로컬 2인·규칙 기반 AI·온라인 경기 실행부를 추가했습니다. 기준 `main` SHA는 `f970554de528b2fceb46aa7aa3a10d43c192b65b`입니다. 이번 변경은 미커밋 상태이며 배포하지 않았습니다.

## 로그인·백엔드·DB 없이 플레이

검증한 환경은 Node **18.20.8**, Yarn **1.22.22**입니다. 이 저장소의 오래된 고정 의존성은 Node 23에서 설치 엔진 검사에 실패했습니다. 의존성/lockfile은 올리지 않았습니다.

```sh
cd frontend
yarn install --frozen-lockfile --non-interactive
yarn serve
```

브라우저에서 `http://localhost:3000/play`를 엽니다. `/play/local`과 `/play/ai`도 공개 경로입니다. 백엔드 프로세스·로그인·게스트 계정 생성이 필요하지 않습니다. 로컬 결과는 서버 전적에 저장하지 않습니다.

- P1: W/S 이동, D Power. P2: ↑/↓ 이동, ← Power. 허브에서 키를 바꿀 수 있습니다.
- AI: Easy/Normal/Hard, 사람은 W/S 또는 화살표 구성을 선택합니다.
- 코트를 클릭해 포커스를 준 뒤 조작합니다. 로컬 화면 숨김/포커스 상실 시 일시정지하며 다시 시작 버튼으로 재개합니다.
- Classic/Power 모두 6점 선승, 경기 종료 뒤 재시작·메뉴 복귀를 지원합니다. Power는 유효 반사로 5칸 충전 후 발동하고 강화 반사마다 1칸 소모합니다.
- 한 키보드 동시 입력은 물리 키보드의 rollover 한계가 있습니다. 모바일 터치 조작은 제공하지 않습니다.

빌드 결과만 실행하는 검증된 방법:

```sh
cd frontend
yarn build
cd ..
node scripts/serve-frontend.cjs
```

정적 프리뷰는 `http://127.0.0.1:4173/play`입니다. 서버를 종료하려면 해당 터미널에서 Ctrl+C를 누릅니다.

## 기존 전체 온라인 서비스

기존 인증·게스트·로비·채팅·프로필·친구·초대·관전 경로를 유지했습니다. 온라인 조작은 기본 ↑/↓와 Space이며 W/S/D도 선택할 수 있습니다. **frontend/backend를 같은 변경 버전으로 함께 실행**해야 합니다. 게임 v1 입력과 snapshot을 사용하며 이전 `update` 프로토콜을 병행하지 않습니다.

```sh
cd backend
npm ci
cp .env.sample .env
# 로컬 테스트 DB와 본인의 기존 OAuth/메일 설정을 작성한 뒤
npm run build
npm run start:prod
```

별도 터미널:

```sh
cd frontend
cp .env.sample .env
# 별도 포트 실행: VUE_APP_BACKEND_URL=http://localhost:5000
#                 VUE_APP_WS_URL=http://localhost:5000
yarn install --frozen-lockfile --non-interactive
yarn serve
```

`backend/src/app.module.ts`의 기존 전체 bootstrap은 PostgreSQL 5432의 기존 개발 DB 설정과 `synchronize:true`를 사용합니다. 운영 DB에 연결하는 절차로 사용하지 마세요. 실제 외부 OAuth/메일을 포함한 이 전체 bootstrap과 Docker 실행은 이번 환경에서 검증하지 못했습니다. 검증한 온라인 경로는 아래의 격리된 실제 JWT·HTTP·Socket.IO·PostgreSQL fixture입니다. Docker build context는 저장소 루트로 조정했으며 Docker CLI가 없어 실행 결과는 BLOCKED입니다.

## 격리된 실제 온라인 검증과 수동 데모

테스트는 `127.0.0.1:55432`, DB/사용자 `arcade_fixture`만 허용하고 매번 새 스키마를 만들어 종료 시 그 스키마만 삭제합니다. 애플리케이션 `.env`를 읽지 않습니다. 기존 OAuth를 우회하는 production 코드는 추가하지 않았습니다. JWT는 테스트 메모리에서만 만들며 테스트 DB 계정만 사용합니다.

먼저 backend `npm ci`, frontend frozen Yarn 설치가 필요합니다. PostgreSQL의 **로컬 native/bin 경로**를 지정합니다. 이 세션에서 실제 사용한 바이너리는 `/private/tmp/ft-transcendence-pg-runtime/node_modules/@embedded-postgres/darwin-x64/native/bin`의 PostgreSQL 14.23입니다. 이 임시 경로는 다른 컴퓨터에 자동으로 존재하지 않습니다.

```sh
ARCADE_PG_BIN=/path/to/postgresql/bin node scripts/test-postgres.cjs start
node scripts/check-arcade.cjs online
ARCADE_PG_BIN=/path/to/postgresql/bin node scripts/test-postgres.cjs stop
```

수동 온라인 데모도 실제 실행했습니다. 테스트 DB를 시작한 상태에서:

```sh
cd frontend
VUE_APP_ENABLE_GUEST_LOGIN=true VUE_APP_ARCADE_DEBUG=true yarn build
cd ..
TS_NODE_PROJECT=backend/tsconfig.json node --no-experimental-fetch \
  -r ./backend/node_modules/ts-node/register \
  -r ./backend/node_modules/tsconfig-paths/register \
  scripts/serve-online-fixture.ts
```

터미널에 출력되는 `/login` URL을 서로 다른 두 브라우저 프로필에서 열어 실제 게스트 버튼으로 로그인하고 `/game`의 '상대 찾기'를 누릅니다. `transpile-only`는 enum decorator metadata가 달라 이 fixture에서 실패했으므로 위 typed 실행을 사용합니다. Ctrl+C는 해당 서버/스키마만 정리합니다. 테스트 helper는 이 Goal이 만든 임시 클러스터만 종료하며 기존 볼륨이나 운영 데이터를 삭제하지 않습니다. 실제 결과는 [검증 기록](docs/arcade-upgrade/TEST_REPORT.md)에 있습니다.

## 회귀 검사와 근거

```sh
node scripts/check-arcade.cjs unit
# 격리 DB를 시작한 상태에서
node scripts/check-arcade.cjs online
```

브라우저 검사에는 기존 Playwright runtime과 Chrome executable이 필요합니다. `ARCADE_PLAYWRIGHT_MODULE`과 `ARCADE_CHROMIUM_EXECUTABLE`로 경로를 지정할 수 있습니다. 로컬/AI Python 검사에는 Playwright가 설치된 Python이 필요합니다. 이 환경에서 실행한 정확한 경로·명령·성공/실패는 [TEST_REPORT](docs/arcade-upgrade/TEST_REPORT.md)에 있습니다. 이 도구들은 일반 플레이 실행에 필요하지 않습니다.

- [기준과 기여 경계](docs/arcade-upgrade/BASELINE.md)
- [경기·AI·네트워크 설계](docs/arcade-upgrade/DESIGN.md)
- [실제 검증 기록](docs/arcade-upgrade/TEST_REPORT.md)
- [측정과 원시 자료](docs/arcade-upgrade/MEASUREMENTS.md)
- [한국어 기술 사례](docs/arcade-upgrade/PORTFOLIO_CASE_STUDY.md)
- [AI 협업과 사람이 확인할 항목](docs/arcade-upgrade/AI_COLLABORATION.md)
- [독립 리뷰 패킷](docs/arcade-upgrade/REVIEW_PACKET.md)

실제 사람 두 명의 물리 키보드 플레이, 원격 WAN/TCP 장애, 외부 OAuth/메일, Firefox/WebKit/Safari, Docker는 별도 검증 범위입니다. 자동 키 입력·제어된 시계·fixture 성공을 이들 검증으로 확대하지 않습니다.

---

# ft_transcendence_final

## Portfolio Demo Guest Login

이 프로젝트의 기본 로그인 방식인 42 OAuth는 과제 요구사항으로 그대로 유지합니다.
포트폴리오 공개 데모에서는 42 계정이 없는 외부 방문자도 기능을 체험할 수 있도록 일회용 게스트 계정 생성 로그인을 추가했습니다.

- 게스트 로그인은 `ENABLE_GUEST_LOGIN=true`일 때만 backend의 `/auth/guest` 엔드포인트에서 활성화됩니다.
- frontend에서는 `VUE_APP_ENABLE_GUEST_LOGIN=true`일 때만 로그인 화면에 `게스트로 체험하기` 버튼을 보여줍니다.
- 게스트 계정은 별도 테이블이나 새 컬럼 없이 기존 `User` 테이블에 저장됩니다.
- 게스트 계정의 `name`과 `nickname`은 같은 `guestId`를 사용합니다. 예: `g` + timestamp 기반 7자
- 게스트 계정의 `email`은 `${guestId}@guest.local` 형식으로 저장됩니다.
- 게스트 프로필 이미지는 별도 이미지 파일을 만들지 않고 `DEFAULT_IMG` 경로를 사용합니다.
- `nickname`을 바로 설정하므로 게스트는 `/info` 닉네임 입력 화면을 건너뛰고 데모를 체험할 수 있습니다.

Azure 배포 환경에서 게스트 로그인을 켜려면 실제 env에 아래 값을 추가합니다.

```
# backend
ENABLE_GUEST_LOGIN=true

# frontend
VUE_APP_ENABLE_GUEST_LOGIN=true
```
