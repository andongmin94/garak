# Garak Studio Rules

이 파일은 `studio/` 아래의 Electron authoring application에 적용된다. 루트
`AGENTS.md`의 제품 경계, dependency 정책과 작업 규칙도 함께 적용한다.

## TypeScript와 모듈 경계

- TypeScript strict mode를 유지한다. `noImplicitAny`, `noUncheckedIndexedAccess`와
  `exactOptionalPropertyTypes`를 완화하지 않는다.
- `any`, unchecked cast와 불필요한 type assertion을 사용하지 않는다. 외부 입력과
  process 경계에는 명시적 type과 runtime validation을 둔다.
- Renderer, Electron main/preload와 feature component의 책임을 분리한다.
- 기능 코드는 `src/features/<feature>/` 경계를 유지한다. Editor-only type이나
  React/Electron type을 향후 language-neutral product model에 누출하지 않는다.

## Electron 보안 경계

- Renderer에서 Node.js API, `require`, `process`, filesystem 또는 shell에 직접
  접근하지 않는다.
- Raw `ipcRenderer` 객체와 generic `send`/`invoke` wrapper를 renderer에 노출하지
  않는다.
- Preload API object와 renderer capability는 작고 명시적이며 읽기 전용으로 유지한다. Canonical Product
  workflow의 new/open/validate/save/export/cleanup side effect는 explicit user action 뒤 Electron main이
  bounded하게 수행하며, renderer에 raw path mutation capability를 주지 않는다.
- `contextIsolation`, sandbox, navigation 차단과 새 창 차단을 비활성화하지 않는다.
- Remote content, network request와 telemetry를 추가하지 않는다. Development URL은
  HTTP loopback으로 제한하고 production에서는 bundled local file만 로드한다.

## UI와 Phase 경계

- UI는 미구현 기능을 작동하는 것처럼 표현하지 않는다. Placeholder에는 현재 phase와
  미구현 상태를 명시한다.
- Sound, Control과 Interface는 Phase 0B placeholder shell을 유지한다. Product workspace는
  [ExecPlan 0006](../plans/0006-phase-1c2-studio-product-workspace-and-export-ux.md)에서 검증한 minimal `.garak`
  create/open/edit/validate/save와 repository-local Windows Debug/Release export 경로를 유지한다.
- Product Compiler의 project schema, identity, validation, serialization과 atomic export를 renderer나
  Electron main에 복제하지 않는다. Main은 callable compiler workflow, dialog, opaque document/cleanup
  capability와 fixed IPC orchestration만 소유한다.
- Phase 2A에서 current schema v2와 legacy v1 open/memory migration status를 typed boundary로 전달하되 migration UI,
  in-place publication 또는 backup/recovery를 구현하지 않는다. Legacy source의 ordinary Save는 shared
  compiler의 migration-required diagnostic을 그대로 보존하며 renderer/main이 silent v2 rewrite를 만들지
  않는다. Phase 2B 전에는 headless explicit distinct-output migration만 canonical publication path다.
- Phase 1C.2/2A 범위 밖 DSP control, audition, general native IPC, routing과 speculative persistence framework를
  추가하지 않으며 placeholder가 구현되지 않은 기능을 제공하는 것처럼 표시하지 않는다.
- Plain CSS와 system font를 사용한다. 외부 font, design system, theme system 또는 UI
  framework를 추가하지 않는다.
- 생성 플러그인에 Studio code, Electron, Chromium, Node.js 또는 JavaScript runtime이
  전이되지 않게 한다.

## Dependency

- Studio external direct dependency 기준선은 runtime 2개와 development 14개, 합계 16개다. Product
  Compiler는 runtime third-party dependency가 0인 별도 workspace source이며 Electron main만
  side-effect-free callable API를 build-time import한다. Renderer와 preload에는 compiler/Node filesystem
  구현을 import하지 않는다.
- Dependency를 추가하기 전에 기존 package와 type이 요구 능력을 제공하는지 확인한다.
- 새 dependency의 실제 필요성, maintenance, transitive cost, license와 generated-plugin
  포함 여부를 검토하고 exact version으로 고정한다.
- Audio, graphics, plugin, packaging, updater, analytics, routing, global state, animation과
  third-party test framework를 현재 Product workflow에 추가하지 않는다.

## 명령

저장소 루트에서 다음 명령을 사용한다.

```text
pnpm studio:dev
pnpm studio:lint
pnpm studio:format
pnpm studio:format:check
pnpm studio:test
pnpm studio:typecheck
pnpm studio:build
pnpm --dir studio verify:product-workflow --configuration Debug
pnpm --dir studio verify:product-workflow --configuration Release
```

`studio/`에서 직접 실행할 때는 각각 `pnpm dev`, `pnpm lint`, `pnpm format`,
`pnpm format:check`, `pnpm test`, `pnpm typecheck`, `pnpm build`를 사용한다. Product workflow smoke는
`pnpm verify:product-workflow --configuration Debug` 또는 `Release`로 실행하며 temp physical project의
new→validate→save→reopen parity 뒤 reference export를 검증한다. 해당 configuration의 prebuilt Product
Runtime과 도구가 있는 repository-local 환경이 필요하다. Legacy v1 open/no-rewrite/save-refusal도 Studio
test contract에 포함한다. 오류를 통과시키기 위해 strict option, lint rule
또는 Electron security option을 무차별로 완화하지 않는다.
