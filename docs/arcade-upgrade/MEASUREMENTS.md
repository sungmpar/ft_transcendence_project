# 표시 지연·snapshot·실행 비용 측정

20Hz snapshot의 같은 입력 재생에서 보간은 공의 프레임 이동량 p95를 **36.9 → 12.3 논리 좌표 단위**로 줄였다. 편도 50ms를 주입한 조건의 표시 상태 나이는 평균 **66.67 → 150.69ms**로 늘었다. 부드러운 위치 갱신과 추가 지연 사이의 교환이며, 입력 응답성이 빨라졌다는 결과가 아니다.

60Hz·고정 지연에서는 즉시 표시와 보간의 이동량 p95가 모두 12.3이었다. 이 조건에서는 보간의 추가 100ms가 같은 지표의 개선을 주지 않았다. 또한 ±40ms 지연 변동에서는 고정 100ms buffer가 12초 관측 중 평균 **73.2회** 고갈됐다. 현재 정책을 모든 네트워크에서 최적이라고 해석하지 않는다.

## 실험 종류와 경계

이 문서의 첫 실험은 실제 `stepGame`, `captureSnapshot`, `SnapshotBuffer` 원본을 Node에서 실행하는 **애플리케이션 snapshot 전달 모델**이다. 코어 입력은 모든 조건에서 같은 tick에 적용하고, snapshot 도착 시간만 바꾼다. 따라서 `nominal_rtt_100`은 계획 조건의 이름이며, 실제 구현은 snapshot 편도 전달에 50ms를 더한다. 실제 왕복 경로·uplink·Socket.IO/TCP 전송을 측정한 값이 아니다.

비대칭 조건은 같은 서버 상태를 보는 두 관측자에게 각각 20ms·80ms를 더한다. 누락 조건은 7번째 snapshot 이벤트를 제외하며, 순서 교환 조건은 7번째 이벤트를 140ms 더 늦춘다. 이는 애플리케이션 이벤트 시험이다. TCP 패킷 손실이나 정상 Socket.IO 연결 안에서의 순서 보장을 모델링했다고 주장하지 않는다. 지연 변동 조건은 ±40ms 균등 난수를 더한 뒤 도착 순서를 유지한다.

Canvas·실제 RAF·브라우저 합성·모니터·키보드는 이 모델에 없다. 사람 입력 수집→화면 표시 지연, 광학 지연, 인간 승률·조작감은 여기서 계측하지 않았다. 실제 Socket.IO 시험은 아래 별도 절과 해당 원시 자료로 구분한다.

## 재현 조건

- 실행 시각: **2026-09-07 05:57:08 UTC**.
- Node **v18.20.8**, Darwin **23.6.0**, Node 아키텍처 **x64**. 보고된 CPU 모델 Apple M3 Max, 논리 CPU 14개. 다른 프로세스의 부하는 통제하지 않았다.
- Git 기준: `f970554de528b2fceb46aa7aa3a10d43c192b65b`. 실행 대상은 이 커밋 위의 미커밋 변경 원본이다.
- 측정 대상 원본 SHA-256 묶음: `37fe020a89eb26a3ed2d3f913f83387e8f1b5965e762d72b138a7ebdc8a1a5c2`.
- 개별 코어·clock·protocol·buffer·측정 스크립트 hash는 [summary.json](measurements/summary.json)의 `metadata.sourceHashes`에 있다. 실행 후 현재 파일 hash와 전부 일치하는지 실제 확인했다.
- 기본 Classic 설정: 1200×800, 60Hz, 6점 선승, 패들 900/s, 초기 공 720/s, 속도 상한 1500/s. seed **20260907**.
- 각 조건·표시 방식당 **5회**. 같은 코어 입력 재생을 5회 실행했고, 모든 상태 시퀀스 SHA-256이 같았다. 이 결과는 같은 Node/구현/설정에서의 재현이며 모든 플랫폼의 bitwise 일치를 보장하지 않는다.
- 시작 120tick을 warm-up으로 제외한 뒤 **720tick, 가상 시간 12초**를 집계했다. 전체 시나리오는 가상 시간 14초다. warm-up도 빠르게 실행된 120tick이며 벽시계로 2초 대기한 시험이 아니다.
- 최종 재생 상태: tick 840, point, 점수 4:1. 6점 종료 전이며 경기 전체 승패 시연을 이 재생으로 대신하지 않는다.
- 입력 trace와 전체 config: [input-trace.json](measurements/input-trace.json). trace hash는 `b716c2b85762b30c2a1a3e1b2252e383282d3ad9cff73bf4081af643a34fc15a`.

저장소 루트에서 실행한 명령:

```bash
/private/tmp/ft-transcendence-runtime/node_modules/.bin/node backend/node_modules/ts-node/dist/bin.js --project backend/tsconfig.json scripts/measure-arcade.ts > docs/arcade-upgrade/evidence/p5-application-measurement.log 2>&1
```

결과 **exit 0**. 일반 Node 18 환경에서는 같은 명령의 Node 경로를 `node`로 바꿀 수 있다. 새로운 의존성은 설치하지 않는다. 실제 표준 설치 방법은 저장소 README를 따른다.

## 계산 방법

보간은 `min(도착시각 − snapshot tick 시각)`으로 clock offset을 추정하고 그 시간축에서 100ms 뒤를 표시한다. 고정 지연은 이 offset에 포함된다. 원시 자료의 `estimated_display_age_ms`는 그 추정 시간축에서의 나이이며, 실제 편도 지연이 아니다.

이 모델은 한 가상 시계에서 서버 tick과 관측 시각을 모두 알 수 있으므로 `source_age_ms_model = 관측시각 − 표시 tick × 1000/60`도 계산한다. 아래 표의 상태 나이는 이 값이다. 서로 다른 실제 머신의 `performance.now()`를 뺀 값은 없다.

공 이동량은 60Hz 가상 표시 프레임 사이의 거리다. 같은 진행 랠리 안의 인접 표시만 사용하고 준비·득점·rally ID·점수 전환은 제외한다. 이는 위치 갱신의 연속성을 보는 지표이며 사용자 체감의 점수는 아니다. 보간 상태의 오차는 **동일한 표시 tick**의 코어 상태와 비교한다. 현재 서버 시점과의 위치 차이를 오차로 섞지 않는다.

각 run에서 최근접 순위 방식의 p95를 구하고 표에는 5개 run의 평균을 쓴다. 원시 run과 표본 수는 [summary.json](measurements/summary.json)에 있다. 평균만으로 숨겨지는 값이 없도록 p50·p95·최댓값도 저장했다. 고갈은 미래 snapshot이 없는 상태로 진입한 횟수이며, 연속 고갈 프레임마다 재계수하지 않는다.

## 고정 지연 결과

| Snapshot | 계획 RTT 라벨 / 주입 편도 | 표시 | 공 이동량 p95 | 상태 나이 평균 / p95 (ms) | 공 위치 변화 0인 프레임 비율 |
|---|---|---|---:|---:|---:|
| 20Hz | 0 / 0ms | 최신 상태 | 36.90 | 16.67 / 33.33 | 67.39% |
| 20Hz | 0 / 0ms | 보간 100ms | 12.30 | 100.69 / 100.00 | 2.17% |
| 20Hz | 100 / 50ms | 최신 상태 | 36.90 | 66.67 / 83.33 | 67.39% |
| 20Hz | 100 / 50ms | 보간 100ms | 12.30 | 150.69 / 150.00 | 2.17% |
| 20Hz | 200 / 100ms | 최신 상태 | 36.90 | 116.67 / 133.33 | 67.39% |
| 20Hz | 200 / 100ms | 보간 100ms | 12.30 | 200.69 / 200.00 | 2.17% |
| 30Hz | 100 / 50ms | 최신 상태 | 24.60 | 58.33 / 66.67 | 50.54% |
| 30Hz | 100 / 50ms | 보간 100ms | 12.30 | 150.23 / 150.00 | 1.08% |
| 60Hz | 100 / 50ms | 최신 상태 | 12.30 | 50.00 / 50.00 | 0.00% |
| 60Hz | 100 / 50ms | 보간 100ms | 12.30 | 150.00 / 150.00 | 0.00% |

득점·서브 경계를 보간하지 않고 이전 상태를 유지하므로 일부 평균 상태 나이가 p95보다 크다. 고정 지연 조건은 고갈 0회였다. 이 입력 trace에서는 공 오차 p95가 0에 가까웠지만, 20Hz 보간의 동일 tick 최대 오차는 **16.05단위**, 30Hz는 **5.15단위**였다. snapshot 사이의 벽·패들 반사를 직선 보간하므로 생기는 한계다. 최신 상태는 원본 snapshot 좌표라 동일 tick 오차가 0이다.

## 변동·비대칭·누락·순서 조건

| 조건 | 최신/보간 공 이동량 p95 | 최신/보간 상태 나이 평균 (ms) | 보간 고갈: 12초 평균 |
|---|---:|---:|---:|
| 50ms ±40ms, 순서 유지 | 36.90 / 17.02 | 76.33 / 112.83 | 73.2회 |
| 관측자 A 편도 20ms | 36.90 / 12.30 | 50.00 / 121.25 | 0회 |
| 관측자 B 편도 80ms | 36.90 / 12.30 | 100.00 / 180.83 | 0회 |
| 7번째 앱 이벤트 누락 | 36.90 / 12.30 | 73.75 / 151.81 | 0회 |
| 7번째 앱 이벤트 140ms 추가 지연 | 36.90 / 12.30 | 73.75 / 151.81 | 0회 |

변동 조건의 최소 offset 추정은 빠르게 도착한 패킷 쪽으로 시간축을 이동한다. 이 때문에 평균 상태 나이는 작아졌지만, 최대 80ms 차이의 지연 변동과 50ms snapshot 간격을 100ms buffer가 항상 흡수하지 못했다. 고갈 때 최신 상태에 고정하며 무제한 예측을 하지 않는다. 평균 73.2회는 개선 완료를 뜻하는 수치가 아니라 **추가 표시 지연이나 적응형 정책 검증이 필요한 근거**다. 이번 범위에서는 고정 정책을 유지하고 한계를 기록했다.

순서 교환 조건에서 뒤늦은 seq는 거절됐다. 누락과 순서 시험이 비슷한 표시 결과를 냈다고 해서 TCP에서 이벤트가 같은 방식으로 유실된다는 뜻은 아니다.

## 메시지 수와 직렬화 크기

동일 편도 50ms 조건, 관측자 한 명, 전체 14초 모델에서의 실제 `JSON.stringify(snapshot)` UTF-8 크기다. 마지막 지연 패킷 일부는 관측 창 뒤에 도착한다. 두 표시 방식은 **동일한 packet 배열과 byte 수**를 사용했다.

| Snapshot | 생성 / 창 안 도착 | 창 안 도착 JSON bytes |
|---|---:|---:|
| 20Hz | 281 / 280 | 216,944 |
| 30Hz | 421 / 419 | 324,804 |
| 60Hz | 841 / 838 | 649,630 |

Socket.IO 이벤트 포장, WebSocket/TCP/TLS 헤더, 압축, 실제 전송·재전송은 포함하지 않는다. 따라서 이 표를 네트워크 전체 대역폭이라고 부르지 않는다. [packets.csv](measurements/packets.csv)에 생성 시각·예약 도착 시각·누락 여부·개별 byte 수가 있다.

## 실제 Node 호출 비용과 clock 상한

warm-up 이후 실제 `stepGame` 호출 **3,600개**의 벽시계 비용은 평균 **0.002538ms**, 중앙값 **0.001167ms**, p95 **0.002125ms**, 최대 **0.686708ms**였다. 이 값은 작은 단일 경기 코어의 호출 비용이며 서버 전체 처리량·지원 동시 경기 수·브라우저 FPS가 아니다. JIT·GC·타이머 분해능·동시 작업의 영향을 통제하지 않았다. [simulation-steps.csv](measurements/simulation-steps.csv)에 warm-up을 포함한 실제 4,200개 호출을 남겼다.

`buffer.display`의 실제 호출 비용도 각 frame과 run에 기록했다. 가상 표시 루프의 처리 비용이며 Canvas 렌더나 실제 RAF 지연을 포함하지 않는다.

| 공급한 경과 시간 | 실제 step callback 수 | 버린 논리 시간 |
|---:|---:|---:|
| 16.67ms | 1 | 0ms |
| 33.33ms | 2 | 0ms |
| 250ms | 8 | 116.67ms |
| 5,000ms | 8 | 4,866.67ms |

이는 `advanceClock`에 실제 값을 전달해 얻은 [clock-policy.json](measurements/clock-policy.json)이다. 5초 동안 실제 부하를 걸었다는 뜻이 아니다. 과부하 시 전체 벽시계를 따라잡지 않고 초과 tick을 버린다는 현재 정책을 확인한다.

## 원시 산출물과 검증 기록

- [summary.json](measurements/summary.json): 환경·설정·hash·분포·100개 run 요약.
- [frames.csv](measurements/frames.csv): **84,100행**, 위치·가상 시간·상태 나이·고갈·실제 display 호출 비용.
- [packets.csv](measurements/packets.csv): **17,550행**, 전달 스케줄과 JSON byte 수.
- [simulation-steps.csv](measurements/simulation-steps.csv): **4,200행**, 실제 core 호출 비용.
- [scenario-runs.csv](measurements/scenario-runs.csv): **100행**, 조건/관측자/표시/반복별 비교.
- [input-trace.json](measurements/input-trace.json), [clock-policy.json](measurements/clock-policy.json).
- [실행 출력](evidence/p5-application-measurement.log).

9개 조건 중 비대칭은 관측자 2명이라 10개 전달 stream이 된다. 10 streams × 2 display modes × 5 repeats = 100 runs다. 원시 CSV 행 수와 source hash를 별도 Node 명령으로 확인했으며 exit 0이었다.

첫 개발 실행에서는 `tick × (1000/60) > 2000`의 부동소수 경계 때문에 warm-up 마지막 tick이 집계에 들어갔다. 정수 `tick > 120`으로 수정하고 다시 실행했다. 본 문서와 최종 raw data는 수정 후 3,600개 측정 표본을 사용한다. 초기 측정값을 최종값으로 섞지 않았다.

## 실제 Socket.IO 왕복·ACK 측정

root가 실제 Nest/Socket.IO/JWT와 격리 PostgreSQL fixture를 실행했다. 추가 왕복 지연 0/100/200ms 각각 3회, 매회 실제 Socket.IO 클라이언트 2개를 연결했다. 한 run은 약 5.4초이며 첫 1초를 echo/ACK 분포에서 제외했다. 60Hz simulation, 명목 20Hz snapshot을 사용했다. 실제 실행은 **PASS, exit 0, 57.39초**였고 [원본 Jest 출력](evidence/p5-real-socket-measurement.log)을 확인했다.

격리 fixture DB가 준비된 상태에서 저장소 루트에서 실행한 정확한 명령:

```bash
/private/tmp/ft-transcendence-runtime/node_modules/.bin/node --no-experimental-fetch backend/node_modules/jest/bin/jest.js --config backend/test/measurement-jest.json --runInBand > docs/arcade-upgrade/evidence/p5-real-socket-measurement.log 2>&1
```

여기서는 입력·probe 송신 직전과 snapshot·probe 응답 전달 직후에 각각 추가 지연의 절반을 애플리케이션 타이머로 적용한다. 즉시 echo RTT는 타이머 지연을 제외한 실제 socket 왕복을 별도로 잰 값이다. 추가 지연을 포함한 echo와 input ACK는 같은 클라이언트의 단일 monotonic clock에서 측정했다. OS/TCP 지연·패킷 손실 주입은 아니다.

아래 분포는 3회 × 2클라이언트의 원시 표본을 모아 직접 다시 계산했다. 각 지연의 즉시/지연 echo 표본은 **24개**다. p95는 최근접 순위를 사용한다.

| 추가 왕복 타이머 | 실제 즉시 echo RTT p95 | 타이머 포함 echo p95 | 입력 수집→서버 적용 ACK 전달 p95 | ACK 표본 수 |
|---:|---:|---:|---:|---:|
| 0ms | 6.074ms | 10.827ms | 56.053ms | 264 |
| 100ms | 3.267ms | 106.105ms | 154.483ms | 270 |
| 200ms | 3.912ms | 206.944ms | 254.671ms | 274 |

참고로 같은 pooled 표본의 최근접 순위 p50은 **2.154 / 1.393 / 1.668ms**다. 짝수 표본의 중앙 두 값 평균이나 상위 중앙값과는 정의가 다르므로 집계 기준을 섞지 않는다. 서로 다른 run 시간대의 즉시 RTT 차이가 추가 지연에 의한 성능 개선을 뜻하지 않는다.

입력 ACK에는 입력 전달, 서버 tick 적용, snapshot 송신 대기, 응답 전달이 모두 포함된다. 실제 모니터의 반응 시간이나 클라이언트 렌더 지연은 포함되지 않는다. 측정은 Node 표시 sampler를 썼으며 브라우저 Canvas 시험과 별개다.

3회·2클라이언트를 합한 snapshot JSON byte 수는 추가 지연 0/100/200ms에서 각각 **480,630 / 497,938 / 507,982 bytes**였다. 입력 bytes·메시지 수와 개별 도착 시각도 raw에 기록돼 있다. 이는 실제 수신 snapshot의 직렬화 크기이며 probe·Socket.IO/WebSocket/TCP/TLS framing을 제외한다. 서버 dropped time은 이 9개 run에서 0ms였다.

이 fixture는 매 경기 실제 생성된 DB ID를 seed로 사용해 run 사이 물리 궤적이 다르다. 따라서 **즉시 표시와 보간의 물리·부드러움 인과 비교에는 위 동일 seed 재생 실험을 사용하고**, 이 자료는 transport/ACK 관측으로만 해석한다. 같은 개발 호스트에서 다른 검증도 실행됐으며 서비스 SLA나 인터넷 환경 보장이 아니다.

- [real-socket-runs.json](measurements/real-socket-runs.json): 각 probe/ACK 원시 표본, 입력/도착 기록, seed, 환경과 방법.
- [real-socket-summary.csv](measurements/real-socket-summary.csv): 18개 클라이언트 run의 개별 요약.
- 시험 소스: [measure-network.e2e-spec.ts](../../backend/test/measure-network.e2e-spec.ts), 설정 [measurement-jest.json](../../backend/test/measurement-jest.json).

실제 브라우저 두 개의 경기·재접속 검증은 TEST_REPORT의 해당 실행 증거와 별개로 확인한다.


## 실제 브라우저 입력 반영 단계 관측

마지막으로 Chrome152.0.7977.77의 로컬 경기에서 실제 keydown handler부터 변경된 패들 위치를 처음 읽는 RAF observer까지 **같은 performance.now 시계**로 기록했다. 2회 warm-up 뒤30표본이며 `/opt/miniconda3/bin/python scripts/measure-local-input.py`는 exit0으로 완료됐다. [raw JSON](measurements/local-input-stages.json), [실제 출력](evidence/p5-local-input-stage.log)에 개별 표본과 방법을 남겼다.

평균9.837ms, p50 4.300ms, p95 19.700ms, 최대83.600ms였다. 이는 합성 키 입력과 브라우저 안의 논리·렌더 단계 관측 상한이며 실제 물리 키보드나 모니터 광학 지연이 아니다. Canvas 픽셀 광학 측정이나 서로 다른 기계 시계 차감은 하지 않았다. 반복 사이40ms대기, W/S교대 입력, game state 주입 없음, 브라우저 실제 시계를 사용했다. 단일 개발 호스트의 scheduler/JIT/동시 부하 영향을 통제하지 않았으므로 보장 지연으로 제시하지 않는다.
