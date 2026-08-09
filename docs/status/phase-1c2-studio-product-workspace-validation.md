# Phase 1C.2 Studio Product Workspace Validation

- 상태: **PASS / Complete**
- 기준일: 2026-08-12
- 범위: Windows x64 repository-local Studio Product workflow
- 관련 문서: [ExecPlan 0006](../../plans/0006-phase-1c2-studio-product-workspace-and-export-ux.md), [ADR 0006](../adr/0006-studio-product-workflow-boundary.md), [Current Status](current.md), [Runtime과 export](../architecture/runtime-and-export.md)

## 판정

Phase 1C.2는 Windows x64 repository-local 범위에서 PASS다. Studio Product workspace가 canonical Product
Compiler facade를 통해 minimal `.garak` project의 create/open/edit/validate/save와 Debug/Release VST3
export를 수행한다. Renderer에는 filesystem, shell, process, raw IPC 또는 arbitrary path mutation 권한이
없고 Electron main이 physical path, native dialog와 opaque document/output/cleanup capability를 소유한다.

이 판정은 packaged Studio, installer, macOS/AU, 실제 DAW 또는 commercial/legal readiness를 포함하지
않는다.

## 시작 기준선

- Branch: `master`
- Commit: `c3f0afb6b9d42d441137e97c115ed96631cae0bc`
- Subject: `feat: complete Garak phase 1C.1 headless Windows export`
- 시작 worktree: clean
- Remote: 없음
- Phase 1C.1: PASS / Complete

## 구현된 workflow

1. 새 Product draft를 만들거나 existing physical `.garak` directory를 연다.
2. Vendor, name, version과 default Gain을 편집한다.
3. Immutable Product ID, derived processor/controller FUID, category와 template를 확인한다.
4. Canonical Product Compiler validation을 field diagnostic으로 확인한다.
5. Whole-directory atomic transaction으로 저장하고 다시 연다.
6. Saved project를 Debug 또는 Release Windows VST3로 export한다.
7. Bundle path, identity, hashes, exact inventory, validator child 결과와 cleanup warning을 확인한다.
8. Studio가 발급한 opaque capability로 compiler-owned orphan만 명시적으로 정리한다.

Studio와 CLI는 validation, canonical serialization, project transaction과 export를 공유한다. Renderer는
physical project/output/orphan path를 mutation request에 넣지 않으며 preload는 fixed typed method만
노출한다. Main은 trusted main-frame sender, runtime request validation, forged capability와 concurrent
operation을 fail closed한다.

## 최종 검증

### TypeScript와 production build

| 검증 | 결과 |
| --- | --- |
| Frozen workspace install | PASS, existing exact lock/toolchain |
| Product Compiler format/lint/typecheck | PASS |
| Product Compiler built-in tests | **52/52 PASS** |
| Studio format/lint/typecheck | PASS |
| Studio built-in tests | **10/10 PASS** |
| Studio production build | PASS |
| Studio direct dependency | 16개 유지 |
| Product Compiler runtime third-party dependency | 0 유지 |

Production build inventory는 다음과 같다.

| Bundle | Modules | Output |
| --- | ---: | ---: |
| Renderer | 21 | JS 209.50 kB, CSS 12.70 kB |
| Electron main | 16 | 53.39 kB |
| Preload | 3 | 5.07 kB |

Bounded `pnpm studio:dev` launch에서 Vite ready와 Electron process 4개를 확인하고 exact process tree를
중지했다. 이는 production build/dev boot evidence이며 수동 GUI 전체 조작이나 packaged application
검증으로 세지 않는다.

### Actual ProductService Debug/Release lifecycle와 export

Repository-local Studio service는 두 configuration 모두 temp physical `.garak`을
new→validate→save→reopen해 saved/reopened true, field parity와 immutable Product ID를 확인했다. 이어
`Artist Gain Warm` reference project를 실제로 열고 canonical export를 호출해 exact three-file bundle,
cleanup warning 0과 다음 child 5개의 exit 0을 확인했다.

1. `moduleinfotool` create
2. `moduleinfotool` validate
3. First-party product Runtime inspector
4. Official Validator standard
5. Official Validator extensive

| Configuration | Runtime SHA-256 | Compiled SHA-256 | moduleinfo SHA-256 | Inventory / child |
| --- | --- | --- | --- | --- |
| Debug | `64CC6BDAFE3F014265F0D7ADE1054F3625B348CDEF6625D8C294FDC3A63222BA` | `3B38FDC841F100A32D5A62BBCBB4016D145847C619F5B9DA73B654A14E1D08B9` | `F780F3DE2D42325A3722584207C17EFCB87A7A9E30D23639FB982C61DED947B4` | 3 / 5 exit 0 |
| Release | `404AD55BA8F397F242ED4052860D2B1698EB51CE7311F5B772710525AE77BDEC` | same | same | 3 / 5 exit 0 |

재현 명령은 해당 configuration Runtime과 도구를 먼저 build한 repository root에서 실행한다.

```text
pnpm --dir studio verify:product-workflow --configuration Debug
pnpm --dir studio verify:product-workflow --configuration Release
```

### Phase 1C.1 native regression

| 검증 | Debug | Release |
| --- | ---: | ---: |
| Fresh configure + clean build | 177/177 PASS | 177/177 PASS |
| No-native-build artifact manifest | 772 unchanged | 641 unchanged |
| Forbidden native-build invocation | 0 | 0 |
| Product Runtime CTest | 7/7 PASS | 7/7 PASS |

Final source snapshot에서 configuration별로 fresh configure, clean build, no-native-build runner와 CTest를
순서대로 실행했다. Runner의 repeated Warm/Bright exports는 configuration별 first 10/10과 second 10/10
child exit 0, Runtime hash parity와 build-tree file inventory 불변을 확인했다.

## Security와 dependency 결과

- Renderer Node/filesystem/shell/process/raw IPC capability: 0
- Generic preload send/invoke: 없음
- Main-owned dialog/path/session/cleanup capability: 유지
- Request/response runtime validation과 trusted sender check: 유지
- Studio external direct dependency: 기존 16개 유지
- Product Compiler runtime third-party dependency: 0 유지
- Context isolation, sandbox, navigation/window-open 차단: 유지
- Generated plugin에 Electron/Chromium/Node/JavaScript runtime 전이: 없음

## 실패와 remediation

- 첫 composite native command는 `cmd`/PowerShell quoting 때문에 intended sequence를 증명하지 못했다.
  이 run은 PASS evidence에서 제외하고 configure/build, runner와 CTest를 exact command로 분리해 재실행했다.
- Sandbox에서 Vite와 native child spawn이 `EPERM`으로 실패했다. 같은 source와 exact command를 승인된
  환경에서 다시 실행해 production build와 ProductService Debug/Release export를 통과했다.
- 일부 pnpm wrapper 실행은 non-TTY auto-verification 문제로 중단됐다. Existing frozen toolchain에서
  official quality/test script를 다시 실행해 52/52 PASS를 얻었고 installed Prettier direct check로 closeout
  Studio instruction formatting도 확인했다.
- 첫 smoke invocation은 `pnpm studio:verify:product-workflow -- --configuration Debug`의 literal `--`를
  script argument로 전달해 usage error로 export 전에 종료됐다. `pnpm --dir studio
  verify:product-workflow --configuration Debug`와 Release 명령으로 교정해 둘 다 PASS했다.
- Final source audit는 response SHA guard의 canonical uppercase enforcement, export result의
  processor/controller FUID 표시와 draft edit/new export attempt 전 stale result clear가 빠진 것을 발견했다.
  세 boundary/UI 문제를 수정하고 production build를 다시 실행했다. Final renderer output은 209.50 kB다.

실패한 run은 최종 PASS 수치에 포함하지 않는다.

## 미검증 release gate

- macOS VST3 arm64/x86_64/Universal, AU와 Apple Clang/Xcode
- Windows/macOS actual DAW scan/load/automation/state restore
- Developer ID signing, notarization, installer/updater와 packaged Studio runtime/tool distribution
- Final single-file `.garak`, project/state migration과 general DSP graph
- Commercial redistribution, full license/notice/trademark/security audit

이 항목은 이번 Windows repository-local PASS로 일반화하지 않는다. [ADR 0003](../adr/0003-generated-plugin-runtime-strategy.md)은 계속 Proposed이며 [ADR 0005](../adr/0005-windows-v0x-prebuilt-product-runtime.md)와 [ADR 0006](../adr/0006-studio-product-workflow-boundary.md)은 각각 문서화된 bounded scope에서만 Accepted다.

## 정확한 다음 milestone

이 문서가 닫힐 당시 다음 milestone은 Phase 2였다. 이후
[Phase 2A](phase-2a-project-migration-validation.md)가 editable schema v1→v2와 headless migration을
**PASS**로 완료했다. 현재 정확한 다음 milestone은 **Phase 2B — Studio Migration, Backup, Recovery and
Durable Persistence UX**이며 Phase 2C compiled/state compatibility는 pending이다.
