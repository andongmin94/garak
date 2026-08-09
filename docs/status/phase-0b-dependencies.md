# Phase 0B Dependency Status

- 기준일: 2026-08-09
- 상태: Direct dependency 검토 완료
- 관련 계획: [Phase 0B ExecPlan](../../plans/0002-phase-0b-buildable-native-and-studio-scaffolds.md)
- 정책: [Dependency and License Policy](../architecture/dependency-policy.md)

## 범위와 판정

Phase 0B의 C++ Native target에는 third-party dependency가 없다. 아래 package는 Garak Studio의 Electron/React 실행과 authoring-time build·quality loop에만 사용한다. Generated plugin은 아직 존재하지 않으며, 향후 generated native runtime에도 이 Studio dependency를 포함하지 않는다.

Manifest, lockfile과 설치된 package metadata에서 direct version과 license field가 일치함을 확인했다. 이는 전체 transitive dependency의 license 또는 보안 audit가 아니며 법률 의견이나 재배포 허가를 의미하지 않는다.

## Direct dependency

| Package | Version | 구분 | 목적 | 알려진 license | Generated plugin 포함 |
| --- | --- | --- | --- | --- | --- |
| `react` | 19.2.8 | Runtime | Renderer component model | MIT | 아니요 |
| `react-dom` | 19.2.8 | Runtime | Renderer DOM mount | MIT | 아니요 |
| `electron` | 43.3.0 | Studio runtime / development | Windows/macOS desktop authoring shell | MIT | 아니요 |
| `vite` | 8.2.1 | Development | Renderer와 Electron build/dev loop | MIT | 아니요 |
| `@vitejs/plugin-react` | 6.0.5 | Development | React transform와 Fast Refresh | MIT | 아니요 |
| `vite-plugin-electron` | 1.1.1 | Development | Main/preload build와 bounded dev lifecycle | MIT | 아니요 |
| `typescript` | 6.0.3 | Development | Strict static typecheck | Apache-2.0 | 아니요 |
| `eslint` | 10.8.1 | Development | Lint runner | MIT | 아니요 |
| `@eslint/js` | 10.0.1 | Development | ESLint recommended rule set | MIT | 아니요 |
| `typescript-eslint` | 8.66.0 | Development | TypeScript parser와 rules | MIT | 아니요 |
| `eslint-plugin-react-hooks` | 7.1.1 | Development | React Hooks rule set | MIT | 아니요 |
| `eslint-plugin-react-refresh` | 0.5.3 | Development | Fast Refresh component export rule | MIT | 아니요 |
| `prettier` | 3.9.6 | Development | Deterministic Studio formatting | MIT | 아니요 |
| `@types/node` | 24.13.3 | Development | Electron main과 build config Node types | MIT | 아니요 |
| `@types/react` | 19.2.18 | Development | React types | MIT | 아니요 |
| `@types/react-dom` | 19.2.4 | Development | React DOM types | MIT | 아니요 |

Electron은 Studio runtime이지만 packaging이 없는 Phase 0B에서는 `devDependencies`에 둔다. Electron 43은 npm postinstall 대신 첫 CLI 실행에 desktop binary를 on demand로 준비하며, 이번 검증에서는 공식 [advanced installation](https://www.electronjs.org/docs/latest/tutorial/installation)의 `install-electron --no` 경로로 Windows x64 binary를 명시적으로 준비했다. Cache miss인 첫 GUI 실행에는 network access가 필요하지만 실행된 Studio renderer 자체에는 remote request나 telemetry가 없다.

## 호환성과 최소성 결정

- TypeScript 7.0.2는 `typescript-eslint` 8.66.0의 `<6.1.0` peer range와 맞지 않아 compatible 6.x인 6.0.3을 선택했다.
- `vite-plugin-electron-renderer`는 optional peer metadata에만 나타나며 설치하지 않았다. Renderer는 Node polyfill, Electron API와 IPC bridge가 필요 없다.
- `vite-plugin-electron`의 기본 development startup이 붙이는 `--no-sandbox`를 사용하지 않는다. `vite.config.mts`가 `startup(['.'])`를 명시하며 실제 main command line에서 flag 부재를 확인했다.
- Routing, global state, UI component, animation, test, packaging, updater와 analytics framework는 추가하지 않았다.

## 남은 검토

- 전체 transitive dependency license, notice와 취약점 audit
- macOS별 Electron binary와 runtime launch
- 향후 Studio packaging·distribution license와 notice 구성
- Generated plugin dependency/redistribution 검증은 해당 native runtime 전략이 결정된 뒤 별도로 수행

이 미완료 항목을 완료된 audit로 표현하지 않는다.
