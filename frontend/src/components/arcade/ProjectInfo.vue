<template>
  <section class="project-info" data-testid="project-info" aria-label="프로젝트 소개">
    <h2>프로젝트 소개</h2>
    <p class="project-intro">
      두 사람이 공을 주고받으며 먼저 6점을 얻으면 승리하는 Pong 게임입니다.
      한 컴퓨터에서 키보드를 나눠 쓰거나, AI와 연습하거나, 온라인으로 대결할 수 있습니다.
    </p>
    <ul class="project-stack" aria-label="사용한 기술">
      <li>Vue 3</li><li>TypeScript</li><li>Canvas 2D</li><li>NestJS</li>
      <li>Node.js</li><li>Socket.IO(WebSocket 전송)</li><li>PostgreSQL</li><li>TypeORM</li>
    </ul>
    <details>
      <summary>사용한 기술과 경기 방식 알아보기</summary>
      <div class="project-details">
        <section>
          <h3>화면과 서버는 어떤 역할을 하나요?</h3>
          <p>Vue 3와 TypeScript로 메뉴와 설정, 경기 상태를 화면에 표시합니다. Canvas 2D로 공과 패들, 경기장과 시각 효과를 그립니다. 패들은 공을 받아치는 막대입니다.</p>
          <p>NestJS와 Node.js는 온라인 입력을 받아 경기를 진행하고 로그인과 서비스 API를 제공합니다. PostgreSQL과 TypeORM으로 사용자 정보와 채팅, 온라인 경기 결과를 저장하고 조회합니다.</p>
        </section>
        <section>
          <h3>온라인 대전은 어떻게 움직이나요?</h3>
          <p>Socket.IO의 WebSocket 전송을 사용해 브라우저와 서버가 입력과 경기 상태, 채팅을 주고받습니다. 서버가 입력을 반영하고 공과 패들의 위치, 점수와 승패를 계산합니다. 브라우저는 서버가 보내는 상태를 화면에 그립니다.</p>
          <p>받은 두 상태 사이의 위치를 계산해 공이 끊겨 보이는 현상을 줄입니다. 이 과정은 움직임을 부드럽게 하지만 화면에 보이는 상태를 조금 늦춥니다. 통신 지연 자체를 줄이는 기능은 아닙니다.</p>
        </section>
        <section>
          <h3>로컬·AI 대전은 무엇이 다른가요?</h3>
          <p>로컬 2인과 AI 대전은 브라우저에서 경기를 진행합니다. 온라인과 같은 TypeScript 경기 코어를 사용하지만 경기를 시작할 때 로그인하거나 게임 서버에 접속할 필요가 없습니다. 이 모드의 결과는 온라인 전적에 저장되지 않습니다.</p>
        </section>
        <section>
          <h3>AI는 어떻게 플레이하나요?</h3>
          <p>규칙 기반 AI는 공의 움직임과 벽에 튕기는 경로를 바탕으로 공이 도착할 위치를 예상합니다. 난이도에 따라 공을 확인하는 주기와 반응 시간, 조준 오차가 달라집니다. 패들의 이동 속도와 Power 사용 규칙은 사람과 같습니다.</p>
        </section>
        <section>
          <h3>제작 배경</h3>
          <p>42서울 팀 프로젝트로 만든 Pong과 로그인·채팅·친구·전적 기능을 바탕으로 개선했습니다. 이후 로컬 2인과 규칙 기반 AI를 추가하고, 경기 규칙과 온라인 상태 표시를 정리했습니다.</p>
        </section>
      </div>
    </details>
  </section>
</template>

<style scoped>
.project-info { margin-top: 24px; padding-top: 22px; border-top: 1px solid #293347; color: #b1bed3; min-width: 0; font-size: 13px; line-height: 1.8; }
.project-info h2 { margin: 0 0 8px; color: #eef2ff; font-size: 19px; font-weight: 750; line-height: 1.4; }
.project-intro { margin: 0; max-width: 850px; }
.project-info p { word-break: keep-all; overflow-wrap: anywhere; }
.project-stack { display: flex; flex-wrap: wrap; gap: 6px 8px; padding: 0; margin: 14px 0; list-style: none; }
.project-stack li { padding: 3px 9px; border: 1px solid #354158; border-radius: 6px; color: #d2ddef; font-size: 12px; max-width: 100%; overflow-wrap: anywhere; }
.project-info summary { width: fit-content; max-width: 100%; color: #92f0d1; cursor: pointer; padding: 5px 0; }
.project-info summary:focus-visible { outline: 3px solid #92f0d1; outline-offset: 4px; border-radius: 2px; }
.project-details { max-width: 900px; padding-top: 8px; overflow-wrap: anywhere; }
.project-details section { margin: 14px 0; }
.project-details h3 { margin: 0 0 6px; font-size: 14px; color: #eef2ff; font-weight: 700; }
.project-details p { margin: 6px 0; }
@media (max-width: 480px) { .project-info { font-size: 12px; } .project-stack { gap: 6px; } }
</style>
