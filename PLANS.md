# Garak ExecPlan Standard

ExecPlan은 여러 파일, 모듈 또는 milestone에 걸친 작업을 처음 보는 사람도 현재 저장소만으로 이어서 수행할 수 있게 하는 살아 있는 실행 문서다. Architecture, persistent contract, dependency, build/export pipeline 또는 장시간 검증을 바꾸는 작업은 구현 전에 ExecPlan을 작성한다.

## 위치와 이름

- ExecPlan은 `plans/NNNN-short-description.md`에 둔다.
- 번호는 기존 계획 다음의 네 자리 연속 번호를 사용한다.
- 하나의 plan은 하나의 명확한 결과와 수용 경계를 가진다.
- 후속 phase는 이전 phase가 수용된 뒤 별도 plan으로 시작한다.

## 운영 규칙

1. 작업 전에 저장소 상태, 관련 문서, 코드, test와 사용자 변경을 조사한다.
2. 첫 변경 전에 목적, 범위, 단계, 검증과 수용 기준을 기록한다.
3. 각 단계가 끝날 때 checkbox 또는 상태를 실제 결과에 맞춰 갱신한다.
4. 예상과 다른 repository fact, constraint, 실패는 `발견 사항`에 즉시 기록한다.
5. 중요한 선택과 이유, 대안, 날짜는 `의사결정 로그`에 남기고 장기 결정이면 ADR도 갱신한다.
6. Plan과 구현·문서가 어긋나면 plan을 현실에 맞게 갱신한다. 완료된 것처럼 보이게 현실을 숨기지 않는다.
7. 검증 명령, 환경과 결과를 기록한다. 실행하지 않은 검증은 통과로 표시하지 않는다.
8. 수용 기준이 충족된 경우에만 `Status: Complete`로 바꾸고 완료 기록을 작성한다.
9. 완료 시 `docs/status/current.md`와 영향을 받은 product/architecture 문서를 동기화한다.

ExecPlan은 진행 보고서만이 아니다. 결정에 필요한 배경과 용어를 포함하고, 저장소 밖 대화나 기억 없이 재현할 수 있어야 한다. 비밀, token, 개인 경로 또는 일시적인 채팅 context를 실행 전제로 두지 않는다.

## 필수 항목

모든 ExecPlan에는 최소한 다음 항목이 있어야 한다.

### 목적

무엇을 완료하며 완료 후 시스템에서 무엇이 달라지는지 설명한다.

### 사용자 가치

사용자 또는 제품이 얻는 관찰 가능한 가치를 설명한다.

### 현재 저장소 상태

조사한 branch, 관련 구현·문서, 기존 test, 사용자 변경과 알려진 결함을 사실대로 기록한다.

### 범위

이번 plan이 책임지는 결과를 열거한다.

### 비범위

의도적으로 하지 않는 작업과 다음 phase로 미루는 항목을 열거한다.

### 전제와 제약

Accepted ADR, platform, realtime, license, toolchain, 보존할 사용자 작업과 승인 경계를 기록한다.

### 설계 결정

작업에 필요한 현재 선택, 이유와 중요한 대안을 기록한다. 아직 결정하지 않은 것은 선택된 것처럼 쓰지 않는다.

### 구현 또는 문서화 단계

작은 end-to-end increment를 순서가 있는 checkbox로 작성한다. 각 단계는 실행 후 검증 가능한 결과를 남겨야 한다.

### 변경 대상 파일

생성·수정·삭제할 파일과 책임을 예상 가능한 범위에서 적는다. 실제 목록이 달라지면 갱신한다.

### 검증 계획

Unit/integration test, build, validator, manual inspection과 실패 조건을 구체적인 명령 또는 절차로 적는다. 지원 platform별 검증 여부를 구분한다.

### 수용 기준

완료를 판정할 관찰 가능하고 검증 가능한 조건을 적는다.

### 리스크

기술, 제품, realtime, 호환성, license, platform과 일정 위험 및 완화 방법을 적는다.

### 발견 사항

작업 중 확인한 예상 밖 사실, 실패, 도구 제한과 문서 충돌을 날짜와 함께 누적한다.

### 의사결정 로그

작업 중 내린 중요한 결정, 이유와 영향을 날짜와 함께 누적한다.

### 완료 기록

완료한 결과, 실제 변경 파일, 수행한 검증과 남은 제한을 적는다. 미완료일 때는 그 사실과 blocker를 적는다.

### 다음 단계

수용 후 시작할 수 있는 정확한 다음 작업만 제안한다. 이번 plan의 미완료 항목을 다음 단계로 위장하지 않는다.

## 권장 머리말

```markdown
# ExecPlan NNNN — Short Title

- Status: Draft | In Progress | Blocked | Complete
- Started: YYYY-MM-DD
- Updated: YYYY-MM-DD
- Owner: team or subsystem
```

`Blocked`는 구체적인 외부 결정이나 권한 없이는 진행할 수 없을 때만 사용하고, blocker와 재개 조건을 완료 기록에 적는다.

## 단계 작성 원칙

- 가장 작은 working path를 먼저 만든다.
- 다음 capability는 앞선 increment가 실제로 작동하고 검증된 뒤 추가한다.
- 서로 독립적인 조사나 검증은 파일 충돌 없이 병렬화할 수 있다.
- Architecture를 임시 우회하는 stopgap을 “나중에 교체”할 전제로 도입하지 않는다.
- 범용 abstraction보다 현재 승인된 요구를 완전히 만족하는 단순한 경계를 우선한다.
- 출시된 persistent schema, product/plugin/parameter ID, versioned sound behavior 또는 외부 제품 contract가 바뀌면 migration과 compatibility test를 같은 단계에 포함한다. Pre-release schema와 obsolete 내부 API에는 compatibility shim을 두지 않고 current canonical path로 갱신한다.
- Realtime path 변경은 allocation, blocking과 bounded-work 검증을 같은 단계에 포함한다.

## 완료와 보고

완료 기록에는 최소한 다음을 남긴다.

- 최종 결과와 사용자에게 보이는 변화
- 실제 생성·수정·삭제 파일
- 수행한 명령과 exit/result 요약
- 수행하지 못한 검증, 이유와 재현 명령
- 알려진 리스크와 제한
- 관련 ADR, product/architecture 문서와 `docs/status/current.md`의 동기화 여부

첫 예시는 [Phase 0A Repository Foundation ExecPlan](plans/0001-phase-0a-repository-foundation.md)이다.
