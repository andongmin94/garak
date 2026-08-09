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
- Preload API는 작고 명시적이며 읽기 전용으로 유지한다. Phase 0B preload는 아무
  API도 노출하지 않는다.
- `contextIsolation`, sandbox, navigation 차단과 새 창 차단을 비활성화하지 않는다.
- Remote content, network request와 telemetry를 추가하지 않는다. Development URL은
  HTTP loopback으로 제한하고 production에서는 bundled local file만 로드한다.

## UI와 Phase 경계

- UI는 미구현 기능을 작동하는 것처럼 표현하지 않는다. Placeholder에는 현재 phase와
  미구현 상태를 명시한다.
- Phase 0B에서는 네 workspace shell과 local tab state만 유지한다. File open/save,
  export, DSP control, native IPC, persistence, routing과 product domain model을 추가하지
  않는다.
- Plain CSS와 system font를 사용한다. 외부 font, design system, theme system 또는 UI
  framework를 추가하지 않는다.
- 생성 플러그인에 Studio code, Electron, Chromium, Node.js 또는 JavaScript runtime이
  전이되지 않게 한다.

## Dependency

- Dependency를 추가하기 전에 기존 package와 type이 요구 능력을 제공하는지 확인한다.
- 새 dependency의 실제 필요성, maintenance, transitive cost, license와 generated-plugin
  포함 여부를 검토하고 exact version으로 고정한다.
- Audio, graphics, plugin, packaging, updater, analytics, routing, global state, animation과
  test framework를 Phase 0B에 추가하지 않는다.

## 명령

저장소 루트에서 다음 명령을 사용한다.

```text
pnpm studio:dev
pnpm studio:lint
pnpm studio:format
pnpm studio:format:check
pnpm studio:typecheck
pnpm studio:build
```

`studio/`에서 직접 실행할 때는 각각 `pnpm dev`, `pnpm lint`, `pnpm format`,
`pnpm format:check`, `pnpm typecheck`, `pnpm build`를 사용한다. 오류를 통과시키기 위해
strict option, lint rule 또는 Electron security option을 무차별로 완화하지 않는다.
