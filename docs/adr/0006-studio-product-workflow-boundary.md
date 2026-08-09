# ADR 0006 — Studio Product Workflow Boundary

- Status: Accepted
- Date: 2026-08-12
- Scope: Phase 1C.2 Windows Studio Product workflow
- 관련 문서: [ADR 0001](0001-typescript-studio-and-cpp20-engine.md), [ADR 0005](0005-windows-v0x-prebuilt-product-runtime.md), [Module Boundaries](../architecture/module-boundaries.md), [Runtime과 export](../architecture/runtime-and-export.md), [ExecPlan 0006](../../plans/0006-phase-1c2-studio-product-workspace-and-export-ux.md)

## Context

Phase 1C.1은 minimal `.garak` directory project에서 deterministic `product.garakbin`과 independent
Windows x64 VST3까지 이어지는 headless path를 검증했다. Phase 1C.2는 이 경로를 Studio Product
workspace에 연결해야 하지만 renderer에 filesystem/process 권한을 주거나 별도 schema/compiler/export를
만들어서는 안 된다.

현재 Product Compiler CLI는 사람이 실행하는 command adapter다. Export 중 child process log와 최종
JSON을 stdout에 순서대로 쓰므로 stable machine RPC가 아니며, Electron executable을 Node CLI runner로
사용하려면 별도 worker/package contract가 필요하다. 반면 compiler core는 Node built-in만 사용하고
strict typed functions와 process-runner dependency injection을 이미 제공한다.

Project create/save와 post-publication orphan cleanup은 기존 CLI에 없는 capability다. 이를 Electron main
또는 renderer가 독자적으로 구현하면 `.garak` validation/serialization과 atomic transaction 의미가
분기한다. Cleanup path를 renderer에 직접 주면 arbitrary path deletion capability가 생긴다.

## Decision

Phase 1C.2의 Studio Product workflow는 다음 경계를 사용한다.

```text
React Product workspace
        ↓ explicit typed method/result
sandboxed contextBridge preload
        ↓ fixed IPC channels + runtime validation
Electron main Product service
        ↓ direct callable TypeScript API
first-party Product Compiler workflow / atomic project and export transactions
        ↓ explicit child process adapter
prebuilt Runtime tools, inspector and official validator
```

- Product Compiler는 callable workflow API를 소유하고 CLI와 Electron main이 모두 이 API에 위임한다.
- Electron main bundle은 compiler workflow를 build-time import한다. CLI stdout parsing, Electron-as-Node
  child worker, native addon과 generic RPC를 사용하지 않는다.
- Main은 file dialog, physical path, project session, output selection, overwrite confirmation와 cleanup
  capability를 소유한다.
- Preload는 new/open/validate/save/export/cleanup의 좁은 read-only API만 노출한다. Raw `ipcRenderer`,
  generic send/invoke, Node/filesystem/shell/process를 노출하지 않는다.
- Main 입구와 preload 출구에서 shared first-party contract를 runtime validate한다. Domain validation은
  Product Compiler만 수행한다.
- Product Compiler는 canonical project serializer와 atomic directory create/save를 소유한다. Invalid
  input은 mutation 전에 거부하고 existing valid project는 stage/backup/rollback transaction으로 보존한다.
- Main은 document와 cleanup을 opaque IDs로 renderer에 전달한다. Renderer는 mutation 대상 absolute path를
  제공하지 않는다.
- Post-commit orphan cleanup은 compiler가 발급한 typed owned artifact를 containment, prefix와 physical
  entry 기준으로 다시 검증한 뒤에만 수행한다. Main은 이를 opaque cleanup ID로 map한다.
- Export는 saved canonical project를 대상으로 하며 main-owned directory selection과 overwrite
  confirmation 후 기존 headless export를 호출한다. Standard/extensive validator를 항상 포함한다.

이 결정은 **Phase 1C.2 Windows repository-local authoring path**에 한정된다. Packaged Studio에 Runtime
tools를 공급하는 installer/resource layout, general graph/native-preview process placement와 macOS/AU
workflow는 결정하지 않는다.

## Alternatives Considered

### Product Compiler CLI를 child process로 실행하고 stdout을 parse

CLI output은 RPC framing이 아니며 Electron executable/Node worker packaging 문제도 새로 만든다. 동일
TypeScript implementation을 직접 호출할 수 있으므로 불필요한 text protocol과 failure surface를 추가하지
않는다.

### Renderer에서 project JSON과 export command를 직접 처리

Renderer sandbox를 무너뜨리고 schema/atomicity를 복제하며 arbitrary path 권한을 만든다. 제외한다.

### Main에서 별도 project writer와 validation을 구현

CLI와 Studio가 서로 다른 canonical bytes, error code 또는 transaction behavior를 가질 수 있다. Product
Compiler가 shared first-party implementation을 소유한다.

### Native addon 또는 Native Engine IPC를 먼저 도입

현재 create/save/export는 Node built-in과 prebuilt external tools로 완결된다. General preview/audio Engine
경계는 다른 요구와 evidence가 필요하므로 speculative dependency와 ABI를 만들지 않는다.

### Renderer에 cleanup path를 전달

Opaque ID보다 단순해 보이지만 compromised renderer가 임의 path deletion을 요청할 수 있다. Compiler와
main이 ownership을 보존하는 capability 방식을 선택한다.

## Consequences

긍정적 결과:

- CLI와 Studio가 하나의 validation, identity, serialization, export와 atomic transaction을 사용한다.
- Renderer sandbox와 least-privilege boundary를 유지한다.
- Product Compiler error code/path/message와 export evidence가 UI까지 손실 없이 전달된다.
- Existing publication commit point를 바꾸지 않고 cleanup warning과 safe remediation UX를 제공한다.
- Studio direct dependency와 generated plugin dependency가 늘지 않는다.

비용과 위험:

- Electron main bundle이 repository 밖 compiler source와 Node built-ins를 정확히 bundle/externalize하는지
  production build에서 검증해야 한다.
- Main이 in-memory document/cleanup capability lifecycle을 관리해야 한다. App restart 뒤 stale capability는
  복구하지 않고 새 open/export로 current state를 재구성한다.
- Repository-local Runtime artifact discovery는 installed Studio packaging contract가 아니다. Missing build
  input은 structured failure로 표시하고 installer phase에서 별도 결정한다.
- Project dialog와 compiler transaction 사이 filesystem race는 mutation 직전 재검증으로 줄이지만 external
  process가 같은 project를 동시에 변경하는 multi-writer coordination은 제공하지 않는다.

## Security and validation boundary

- Trusted sender가 아닌 IPC, unknown channel과 malformed request/response는 fail closed한다.
- Product ID는 main-generated/session-owned이며 draft request로 바꿀 수 없다.
- Renderer request에는 physical project/output/orphan mutation path가 없다.
- Existing export replacement과 orphan cleanup은 각각 explicit native confirmation을 요구한다.
- Navigation/new-window 차단, context isolation, sandbox와 Node integration off를 유지한다.
- Network, telemetry와 remote content를 추가하지 않는다.

## Deferred decisions

- General graph compiler/native preview/audio-device process topology
- Packaged Studio의 Runtime/tool resource layout와 updater/installer
- macOS sandbox/bookmark, VST3/AU export와 signing/notarization
- Cross-process cancellation/progress streaming과 background job queue
- Multi-document recovery, autosave, undo history와 Phase 2B released project migration publication UI

이 ADR은 ADR 0003의 Proposed cross-platform runtime 전략을 Accepted로 바꾸지 않으며 ADR 0005의
Windows x64 v0.x scope만 Studio에서 소비한다.

Phase 2A는 이 process/security boundary 안에서 legacy schema v1 open의 current v2 memory document와
migration-required status를 typed boundary로 전달하고 ordinary Save를 fail closed하도록 확장했다. Renderer에 filesystem
또는 migration publication path를 추가하지 않았고, confirmation/backup/recovery/in-place publication은
Phase 2B로 남겼다. Exact 결과는
[Phase 2A validation](../status/phase-2a-project-migration-validation.md)에 기록한다.
