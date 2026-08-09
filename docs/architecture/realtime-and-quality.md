# Realtime and Quality Contract

- 상태: Phase 0A architecture 기준선
- 권위: audio process callback 규칙, prepare/process 경계, 실시간·오디오 품질 검증
- 관련 문서: [v0.1 PRD](../product/v0.1-prd.md), [Parameter and State](parameter-and-state.md), [Interface Designer](interface-designer.md)

## 목적과 적용 범위

이 문서는 Native Engine과 생성 플러그인의 실시간 불변식을 정의한다. “audio process callback”은 host callback뿐 아니라 그 callback이 동기적으로 호출하는 graph, node, parameter, meter와 adapter code 전체를 뜻한다. 구체적인 class, queue 또는 DSP 알고리즘은 확정하지 않는다.

## Audio callback 금지 규칙

Callback과 그 하위 경로에서는 다음을 금지한다.

- 동적 메모리 할당 또는 해제와 암묵적인 container growth
- mutex, blocking lock, condition wait, sleep 또는 thread join
- 파일 I/O
- 네트워크 I/O
- JSON을 포함한 state parsing 또는 schema migration
- GUI, window/message-loop 또는 UI object 호출
- 로그 파일 기록
- callback 경계 밖으로의 예외 전파
- DSP graph의 node, connection 또는 실행 구조 변경
- 실행 시간 상한을 합리적으로 예측할 수 없는 blocking operation

특정 lock-free 자료구조는 아직 선택하지 않았다. 구현은 callback이 기다리지 않고, 준비된 graph와 현재 block에 대해 bounded하며, UI나 background worker의 진행에 의존하지 않는다는 결과로 검증한다.

## Lifecycle과 prepare/compile 경계

실제 API 명칭은 미정이지만 책임은 다음처럼 분리한다.

### Compile/configure

- project/schema, node/port/connection과 허용 cycle을 검증한다.
- node implementation version과 resource reference를 확인한다.
- execution schedule, buffer lifetime/reuse와 latency path를 계산한다.
- public parameter, macro, internal target와 scene binding을 compile한다.
- 상세 diagnostic을 생성한다.

Parsing, migration과 graph structural edit는 이 단계 또는 다른 non-realtime control 단계에서만 수행한다.

### Prepare

- host sample rate, maximum block size와 channel layout을 적용한다.
- 필요한 memory, audio/control buffer와 node scratch/history를 모두 확보한다.
- coefficient, parameter smoothing state와 converter를 준비한다.
- latency, bypass와 process용 immutable/bounded runtime view를 확정한다.

Host가 prepare 범위를 벗어난 조건을 보낼 때 callback 안에서 buffer를 키우거나 graph를 재compile하지 않는다. Format별 안전한 실패 정책은 후속 spike에서 정한다.

### Activate/process

- 준비된 schedule, buffer, mapping과 DSP state만 사용한다.
- host input, automation event와 transport context를 bounded하게 읽는다.
- compile된 순서대로 node를 실행하고 latency/bypass 계약을 지킨다.
- meter/status snapshot을 non-blocking 경계로 게시한다.
- 오류를 숨기지 않되 callback 안에서는 blocking diagnostic을 만들지 않는다. Host에 반환할 format-defined status와 fail-safe audio 결과는 error 종류별 adapter 정책으로 정한다.

오류 시 silence, bypass 또는 다른 결과 중 무엇을 낼지는 오류 종류별로 명시해야 하며 아직 미결정이다.

### Deactivate/release

Callback이 종료되었다는 lifecycle 보장 뒤 resource를 해제한다. Background 종료나 memory 해제를 기다리게 하는 일을 audio thread에서 수행하지 않는다.

## Parameter, state와 UI handoff

- Automation의 block/sample-offset 의미를 보존해 prepared parameter runtime에 전달한다.
- Serialized state의 parsing, validation과 migration은 callback 밖에서 끝내고 검증된 snapshot만 runtime에 전달한다.
- UI는 DSP object를 직접 변경하지 않고 audio callback은 GUI를 호출하지 않는다.
- Meter는 read-only 관찰 정보이며 영속 parameter/state와 구분한다.
- UI가 update를 놓치거나 멈춰도 audio processing은 계속되어야 한다.

Automation, macro mapping, clamp와 smoothing의 정확한 적용 순서 및 snapshot 교환 구현은 미정이다. 자세한 identity/state 계약은 [Parameter and State](parameter-and-state.md)를 따른다.

## Compile 전에 결정할 실행 정보

- node implementation과 version, execution order
- audio/control buffer size, owner, lifetime과 in-place 허용 여부
- channel conversion과 node scratch/history memory
- parameter/macro target과 compiled curve
- graph/node latency와 host에 보고할 total latency
- runtime data, scene binding과 asset의 유효성

Graph edit는 새 runtime을 compile/prepare한 뒤 안전한 lifecycle 경계에서 교체한다. Tail, latency와 node state continuity 정책은 미정이다.

## 품질 계약

### 실시간 안전성

- 정상 및 오류 경로 모두 callback allocation과 blocking이 없어야 한다.
- UI, disk, network와 worker 속도가 callback deadline을 결정하지 않아야 한다.
- Automation/state stress와 지원 최대 graph 조건에서 작업량이 측정 가능해야 한다.

### 오디오 정확성과 호환성

- Mono/stereo routing, channel conversion, bypass와 latency reporting이 정의와 일치해야 한다.
- Silence, impulse, constant/reference audio와 extreme parameter에서 NaN/Inf, 비정상 gain 또는 channel corruption을 만들지 않아야 한다.
- Sample rate, block size, dense automation과 denormal-sensitive input을 검증해야 한다.
- 같은 compiled data/state/input은 승인 tolerance 안에서 재현 가능해야 한다.
- Sound-changing node update는 기존 implementation version을 덮어쓰지 않는다.
- Studio audition과 generated runtime은 같은 graph/parameter/node-version 의미론을 따라야 한다.

## 검증 계획

구현 ExecPlan은 명령, test target과 결과 저장 위치까지 구체화한다.

### Callback와 stress

- Allocation/deallocation instrumented test
- Lock/wait와 blocking system call profiler 또는 stress trace
- 느린 UI/log/disk/background worker 상태의 audio continuity test
- Adapter exception containment test
- Graph edit와 state restore가 callback mutation을 만들지 않는 test

### Processing와 audio

- 지원 sample rate, 고정/변동 및 최소/최대 block size
- mono/stereo와 channel conversion
- bypass 전환, latency measurement와 reporting
- silence, impulse, constant, small/extreme amplitude, malformed control
- slow sweep, rapid/dense automation
- node invariant, graph routing과 golden/reference audio
- preset/DAW state round trip 및 migration fixture
- Studio preview와 generated plugin의 동일 fixture 비교
- `ANDONGMIN — BLOOM` reference audio listening review와 회귀 test

### Host와 package

- Windows x64 VST3 공식 validator와 실제 host smoke test
- macOS arm64/x86_64 VST3 검증과 Universal VST3 package의 공식 validator 및 실제 host smoke test
- macOS AU 공식 validator와 실제 host smoke test
- plugin unload/reload와 DAW session reopen
- clean offline system의 load, process, UI, preset과 state restore
- package에 Electron, Chromium, Node.js 또는 임의 JavaScript runtime이 없는지 inspection

검증 순서는 Windows VST3, macOS VST3, macOS AU이다. 앞 단계 통과만으로 전체 v0.1 품질 수용을 주장하지 않는다.

## 아직 수치화하지 않은 기준

- target CPU별 평균·최악 CPU와 deadline miss/xrun 허용치
- 최대 graph 규모, memory budget와 plugin latency
- sample rate, block size, channel layout와 host/OS matrix
- floating-point precision, denormal, NaN/Inf 정책
- golden audio와 Studio/native parity tolerance
- automation timing 오차와 meter update/drop 허용치

미정은 “제약 없음”을 뜻하지 않는다. v0.1 수용 전에 benchmark 환경과 측정 도구를 포함한 pass/fail 값으로 바꾼다.

## Phase 0A 비범위와 Open Questions

Phase 0A에서는 DSP/runtime/adapter, lock-free 구조를 구현하거나 benchmark를 통과했다고 주장하지 않는다.

- Prepare 범위를 벗어난 host 조건의 안전한 실패 결과는 무엇인가?
- Runtime 교체 시 tail, latency와 state continuity를 어떻게 처리할 것인가?
- Automation, macro mapping과 smoothing의 적용 순서는 무엇인가?
- Error별 fail-safe output과 cross-platform audio tolerance는 무엇인가?
- BLOOM reference audio, listening protocol과 승인 책임자는 누구인가?
