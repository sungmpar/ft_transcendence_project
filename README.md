# ft_transcendence

```
- 실행 순서
1. cd docker -> make db
2. cd backend -> cp env.sample env -> env 작성 ->
npm install -> npm run start:dev
3. cd frontend -> yarn install -> yarn serve

- 종료 순서
1. backend, frontend 각 프로세스 종료
2. cd docker -> make clean
```
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
