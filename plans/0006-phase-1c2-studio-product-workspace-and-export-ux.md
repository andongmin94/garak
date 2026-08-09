# ExecPlan 0006 — Phase 1C.2 Studio Product Workspace and Export UX

- Status: Complete
- Started: 2026-08-12
- Updated: 2026-08-12
- Owner: Studio / Product Compiler

## 목적

Phase 1C.1의 minimal `.garak` project와 headless Product Compiler/export를 Garak Studio의 Product
workspace에 연결한다. 완료 후 사용자는 Windows Studio에서 product를 만들고 열고 편집하고 안전하게
저장하며, 같은 canonical compiler를 통해 Debug 또는 Release VST3를 export하고 결과와 진단을 확인할 수
있다.

이 계획은 별도 project schema, compiler, runtime 또는 renderer-side filesystem 경로를 만들지 않는다.
Phase 1C.1의 atomic publication commit point와 structured diagnostic을 그대로 사용하며, Studio는 해당
결과를 안전한 authoring UX로 표현한다.

## 사용자 가치

- 사용자가 JSON과 명령행을 직접 다루지 않고도 첫 Garak product를 만들고 다시 열 수 있다.
- Product ID, white-label metadata, version과 Gain default가 canonical `.garak` contract로 저장된다.
- Debug/Release VST3 export, identity, hash, inventory와 validator 결과를 한 workspace에서 확인한다.
- Invalid project 또는 export failure는 기존 valid project/bundle을 훼손하지 않고 field와 단계가 명확한
  진단으로 표시된다.
- Publication 뒤 cleanup이 실패해도 성공한 product를 실패로 오인하지 않으며, Studio가 소유권을 확인한
  transaction artifact만 명시적 사용자 동작으로 정리한다.

## 시작 기준선

- 시작 branch는 `master`, 시작 commit은
  `c3f0afb6b9d42d441137e97c115ed96631cae0bc` (`feat: complete Garak phase 1C.1 headless
  Windows export`)다.
- Phase 1C.1의 80개 변경 경로는 위 local checkpoint commit에 고정했고 시작 worktree는 clean이다.
- Git remote는 없으며 이 계획은 branch 생성, push 또는 GitHub repository 생성을 요구하지 않는다.
- Studio는 시작 시 Electron 43, React 19와 strict TypeScript를 사용하는 Phase 0B shell이었다. Product
  workspace, preload API와 Electron IPC는 placeholder/empty 상태였다.
- Studio direct dependency는 runtime 2개와 development 14개, 합계 16개다.
- Product Compiler는 시작 시 runtime third-party dependency 0으로 strict project load, identity, compile,
  atomic Windows export와 structured diagnostic을 제공했다. CLI stdout은 RPC protocol이 아니었고 Electron
  main이 재사용할 callable workflow API는 없었다.
- Minimal `.garak` v1은 exact lowercase `product.json` 하나를 가진 physical directory package다.
- Phase 1C.1 final evidence는 Product Compiler 36/36, Runtime Debug/Release clean build 177/177,
  CTest 7/7, Werror/clang-tidy 110/110, first-party format 58 files와 official validator 8회 PASS다.
- macOS/AU, 실제 DAW, signing/notarization, installer와 commercial/legal readiness는 미검증 release
  gate다.

## 범위

1. Studio와 CLI가 공유하는 Product Compiler callable workflow API
2. Canonical project draft validation, deterministic serialization과 atomic directory create/save
3. Product ID의 main-process 생성과 이후 read-only 보존
4. Electron main이 소유하는 project session, file dialog, output selection과 overwrite confirmation
5. Explicit typed renderer ↔ preload ↔ main API와 양쪽 runtime boundary validation
6. Product workspace의 new/open/edit/validate/save lifecycle
7. Debug/Release export, progress, success/failure, identity/hash/inventory/child outcome 표시
8. `cleanupDiagnostics` 경고 표시와 opaque cleanup capability를 통한 owned orphan cleanup
9. Product Compiler, Studio와 Phase 1C.1 canonical regression
10. ExecPlan, ADR, architecture, status, README/ROADMAP와 적용 AGENTS 정합화

## 비범위

- macOS VST3, Universal VST3, AU와 Apple Clang/Xcode 검증
- 실제 DAW matrix, signing, notarization, installer/updater와 commercial packaging
- Single-file `.garak`, migration, general DSP graph/compiler, macro, preset, asset와 audition
- Custom plugin editor, Interface Designer 구현과 native preview
- Native addon 또는 general Studio/native Engine IPC
- Renderer filesystem, shell, process, raw `ipcRenderer` 또는 generic invoke/send API
- Product Compiler subprocess protocol, 별도 worker executable과 packaged Studio runtime distribution
- Skia, CanvasKit, Yoga, XYFlow, UI framework, router, state library와 test framework 추가
- Cloud, telemetry, marketplace, auth, DRM, BLOOM과 root license 결정
- ADR 0003의 cross-platform runtime 결론

## 전제와 제약

- 현재 사용자 지시, root/studio `AGENTS.md`, Accepted ADR 0001/0002/0004/0005와 normative Phase 1C.1
  contract를 따른다.
- Renderer는 sandbox/context isolation을 유지하고 Node/filesystem/shell/process 권한을 받지 않는다.
- Studio는 Product Compiler의 schema, identity, validation 또는 atomic export 의미를 복제하지 않는다.
- Product ID는 새 draft 생성 시 한 번 발급하며 기존 document 편집으로 변경하지 않는다.
- Category `Fx`, template `garak.gain-v1`, Gain ID `1001`과 Bypass ID `1002`는 read-only contract다.
- 입력을 trim, clamp, slug 또는 자동 복구하지 않는다. Unknown field를 무시하지 않는다.
- Invalid save는 기존 valid project를, failed export는 기존 valid bundle을 훼손하지 않는다.
- 기존 Studio direct dependency 16개와 Product Compiler runtime dependency 0을 유지한다.
- Repository-local prebuilt Runtime tree를 소비하는 Windows authoring slice만 검증한다. Packaged Studio에
  Runtime/tool을 공급하는 installer contract는 이번 범위가 아니다.

## 설계 결정

### Callable compiler workflow

Electron main은 `tools/product-compiler`의 exported TypeScript workflow를 build-time import해 직접
호출한다. CLI도 같은 workflow에 위임한다. CLI stdout을 파싱하거나 Electron executable을 Node child로
재실행하지 않는다. Product Compiler는 Node built-in만 사용하므로 Studio dependency 또는 generated
runtime dependency가 추가되지 않는다.

상세 process/ownership 결정은
[ADR 0006](../docs/adr/0006-studio-product-workflow-boundary.md)이 권위를 가진다.

### Project document와 atomic save

Main process는 opaque document session과 physical project path를 소유한다. Renderer에는 display path와
editable first-party fields만 전달한다. 새 draft의 Product ID는 main에서 생성한다.

Product Compiler는 draft를 기존 validator로 검증하고 canonical key order, UTF-8 without BOM, LF와
final newline로 serialize한다. Create/save는 sibling stage directory를 완전히 검증한 뒤 final directory로
rename한다. Existing valid project 교체는 transaction backup과 rollback을 사용하고 post-commit cleanup은
성공 결과의 bounded diagnostic으로 표현한다.

### Typed IPC와 capability

Preload는 new/open/validate/save/export/cleanup의 구체 메서드만 read-only object로 노출한다. Request와
response는 explicit discriminated union이며 main 입구와 preload 출구에서 runtime 검증한다. Main은
sender와 document/cleanup capability를 확인한다.

Renderer는 project path나 orphan path를 mutation 요청에 넣지 않는다. Main이 session ID와 cleanup ID를
opaque capability로 발급하고 내부 map에서 canonical path와 compiler-owned cleanup descriptor를 찾는다.

### Export와 overwrite

Export는 saved canonical document만 대상으로 한다. Main이 output directory dialog를 소유하며 existing
bundle이 있으면 native confirmation 뒤에만 canonical export의 `force`를 true로 전달한다. Standard와
extensive validator는 export에서 항상 실행한다.

Success view는 bundle path, configuration, processor/controller FUID, runtime/compiled/moduleinfo hash,
inventory와 child exit를 표시한다. Failure는 compiler diagnostic code/path/message를 유지한다.

### Cleanup UX

Product Compiler는 post-commit orphan을 typed owned artifact로 반환하고 cleanup 함수가 containment,
expected sibling prefix, physical entry와 transaction ownership을 다시 확인한 뒤에만 제거한다. Electron
main은 이를 opaque cleanup ID로 바꾼다. Renderer는 arbitrary path를 보내거나 삭제할 수 없다.

### 검증 방식

새 third-party test framework를 추가하지 않는다. Product Compiler와 non-Electron Studio boundary/model은
Node built-in test로 검증한다. Studio production build와 bounded Electron launch로 실제 preload/UI wiring을
검증하고 canonical Phase 1C.1 build/export/CTest를 regression한다.

## 구현 단계

- [x] 1. Phase 1C.1을 local checkpoint commit으로 고정하고 clean baseline을 확인한다.
- [x] 2. Phase 1C.2 범위, 기존 Studio/Compiler 경계와 dependency 기준선을 감사한다.
- [x] 3. 이 ExecPlan과 ADR 0006으로 workflow/process/security 결정을 기록한다.
- [x] 4. Product Compiler callable workflow, project serializer와 atomic create/save를 구현하고 test한다.
- [x] 5. Typed cleanup artifact와 ownership-rechecking cleanup API를 구현하고 fault test한다.
- [x] 6. Studio shared contract, main document service와 explicit IPC handler를 구현하고 boundary test한다.
- [x] 7. Preload의 narrow read-only API와 renderer Window typing을 구현한다.
- [x] 8. Product workspace new/open/edit/validate/save vertical slice를 구현하고 round-trip을 검증한다.
- [x] 9. Debug/Release export, overwrite confirmation, result/diagnostic/cleanup UX를 구현한다.
- [x] 10. Studio lint/format/typecheck/test/build와 bounded dev/production workflow를 검증한다.
- [x] 11. Product Compiler quality/test와 Phase 1C.1 Debug/Release export/CTest/validator regression을 수행한다.
- [x] 12. Dependency/security/hygiene와 renderer bundle의 Node/fs/shell leak를 감사한다.
- [x] 13. README, ROADMAP, AGENTS, architecture/status와 이 living plan을 실제 결과로 닫는다.
- [x] 14. Final source/evidence consistency와 repository hygiene를 감사하고 blocker 0을 확인한다.

## 변경 파일

- `plans/0006-phase-1c2-studio-product-workspace-and-export-ux.md`
- `docs/adr/0006-studio-product-workflow-boundary.md`
- `tools/product-compiler/src/`의 callable API, project document transaction, owned cleanup과 CLI/export adapter
- `tools/product-compiler/tests/`의 API/project transaction/export atomicity/owned cleanup test
- `studio/src/shared/product_api.mts`의 process-neutral typed contract와 runtime guard
- `studio/electron/`의 ProductService, main IPC와 preload
- `studio/src/features/product/`의 state/model과 Product workspace
- `studio/src/App.tsx`, `studio/src/app.css`, `studio/src/global.d.ts`
- `studio/tests/`의 boundary/service/state test와 `studio/scripts/verify_product_workflow.mts`
- Root/studio package와 TypeScript config의 dependency-free test/workflow script
- `README.md`, `ROADMAP.md`, root/studio `AGENTS.md`
- `docs/architecture/module-boundaries.md`, `docs/architecture/runtime-and-export.md`
- `docs/status/current.md`, 신규 Phase 1C.2 validation status

## 검증 계획

### Product Compiler

```text
pnpm product:lint
pnpm product:format:check
pnpm product:typecheck
pnpm product:test
```

Project transaction tests는 create/save/reopen, deterministic bytes, invalid no-mutation, existing-output
refusal, forced atomic replace, backup/publication/rollback/cleanup fault와 safe orphan ownership rejection을
포함한다. CLI 4-command regression도 유지한다.

### Studio

```text
pnpm studio:lint
pnpm studio:format:check
pnpm studio:typecheck
pnpm studio:test
pnpm studio:build
pnpm studio:dev
```

Boundary tests는 malformed request/response, forged document/cleanup ID, immutable Product ID, cancellation,
dialog/output capability와 diagnostic mapping을 포함한다. Bounded dev launch에서 new → edit → validation →
save → reopen → Debug/Release export → overwrite confirmation → result display를 확인한다. Production output에서
renderer Node/fs/shell/raw IPC leak와 security option을 정적으로 감사한다.

### Native와 headless regression

Visual Studio x64 Developer Command 환경에서 final source snapshot으로 다음을 수행한다.

```text
cmake --preset product-runtime-debug --fresh
cmake --build --preset product-runtime-debug-build --clean-first
tools\product-compiler\scripts\verify_headless_export_no_build.ps1 -Configuration Debug
ctest --preset product-runtime-debug-test --no-tests=error

cmake --preset product-runtime-release --fresh
cmake --build --preset product-runtime-release-build --clean-first
tools\product-compiler\scripts\verify_headless_export_no_build.ps1 -Configuration Release
ctest --preset product-runtime-release-test --no-tests=error
```

Product Compiler/native contract가 바뀌지 않았더라도 Studio export가 같은 result를 소비함을 확인한다.
Phase 0/1A/1B regression 범위는 변경 영향과 최종 시간에 비례해 실행하며 생략한 검증은 정확히 기록한다.

### Repository hygiene

- `git diff --check`
- strict UTF-8 without BOM, LF, final newline와 trailing whitespace 검사
- Markdown local link 검사
- Studio direct dependency 16, compiler runtime dependency 0와 lock importer 일치
- SDK/nested gitlink exact pin/clean, SDK source diff 0
- ignored build/export 외 native binary와 generated output leak 0

## 수용 기준

- Studio Product tab이 placeholder가 아니라 create/open/edit/validate/save/export working path다.
- Save→reopen이 exact fields와 Product ID를 보존하고 invalid save가 prior project를 변경하지 않는다.
- Renderer에는 Node/fs/shell/process/raw IPC와 arbitrary path deletion capability가 없다.
- Main/preload boundary가 malformed value, forged session/cleanup capability를 fail closed한다.
- Studio와 CLI가 동일 Product Compiler validation/serialization/export 구현을 사용한다.
- Debug/Release export가 exact three-file bundle, expected identity/hash/inventory와 successful validator 결과를
  표시한다.
- Existing bundle replacement은 native confirmation 전에는 수행되지 않는다.
- Post-commit cleanup failure는 successful publication + warning으로 표시되며 owned artifact만 cleanup할 수
  있다.
- Studio direct dependency 16과 Product Compiler runtime dependency 0이 유지된다.
- Studio quality/build, Product Compiler quality/tests와 mandatory Phase 1C.1 regression이 PASS한다.
- macOS/AU/DAW/signing/installer 미검증을 PASS로 일반화하지 않는다.
- Plan, ADR, architecture, status와 public instructions가 final source/evidence와 일치한다.

## 리스크

- Vite Electron main bundle이 repository 밖 compiler source를 잘못 externalize할 수 있다. Production main
  output을 실행/검색해 callable workflow가 실제 bundle에 포함되는지 검증한다.
- Repository-local Runtime path는 installed Studio distribution contract가 아니다. Missing artifact를
  structured diagnostic으로 표시하고 packaging을 이번 phase에 암묵적으로 추가하지 않는다.
- File dialog 뒤 filesystem state가 바뀔 수 있다. Compiler가 mutation 직전에 physical inventory와 ownership을
  다시 검증한다.
- Renderer가 session ID를 위조할 수 있다. Main-owned capability map과 trusted sender check를 사용한다.
- Cleanup action은 파괴적이다. Compiler-owned exact path/prefix/containment 재검증과 explicit confirmation을
  모두 요구한다.
- No DOM test framework이므로 accessibility/interaction regressions를 pure state test, production build와
  bounded GUI inspection으로 보완한다.
- Windows 성공은 macOS/AU와 packaged installer 성공을 증명하지 않는다.

## 발견 사항

- 2026-08-12: Phase 1C.1은 문서상 의도적으로 uncommitted였고 remote가 없었다. Phase 1C.2와 변경을
  섞지 않기 위해 사용자 범위 안에서 local checkpoint commit `c3f0afb`를 만들었다.
- 2026-08-12: CLI stdout은 child process line과 pretty JSON을 함께 출력하므로 stable RPC가 아니다.
- 2026-08-12: Electron `process.execPath`는 Electron executable이므로 별도 packaged Node/worker contract
  없이 CLI child process로 사용하는 것은 현재 범위를 키운다.
- 2026-08-12: Existing `cleanupDiagnostics`에는 user-visible message만 있고 safe cleanup용 structured
  ownership capability가 없다.
- 2026-08-12: Studio에는 test framework가 없지만 Node 24 built-in test와 existing TypeScript toolchain을
  dependency 추가 없이 사용할 수 있다.
- 2026-08-12: Studio와 CLI가 공유하는 callable facade, canonical project document transaction과
  ownership-rechecking cleanup API를 Product Compiler runtime dependency 추가 없이 구현했다.
- 2026-08-12: Product workspace는 Product ID/category/template를 immutable로 표시하고 editable metadata와
  Gain default를 canonical validation/save/export 경로에 연결한다. Sound/Control/Interface는 명시적
  placeholder로 남는다.
- 2026-08-12: Final source audit에서 response SHA guard의 canonical uppercase enforcement, export result의
  processor/controller FUID 표시와 draft edit/new export attempt 전 stale result clear가 빠진 것을 발견해 수정했다.
  이후 production build는 renderer 21 modules, Electron main 16 modules와 preload 3 modules를 생성했다.
  Renderer JS는 209.50 kB, CSS는 12.70 kB, main은 53.39 kB, preload는 5.07 kB다.
- 2026-08-12: Final native rebuild로 Runtime hash가 Debug
  `64CC6BDAFE3F014265F0D7ADE1054F3625B348CDEF6625D8C294FDC3A63222BA`, Release
  `404AD55BA8F397F242ED4052860D2B1698EB51CE7311F5B772710525AE77BDEC`로 갱신됐다. Compiled data와
  moduleinfo hash는 각각 `3B38FDC841F100A32D5A62BBCBB4016D145847C619F5B9DA73B654A14E1D08B9`,
  `F780F3DE2D42325A3722584207C17EFCB87A7A9E30D23639FB982C61DED947B4`로 configuration 사이에서
  안정적이다.

## 의사결정 로그

- 2026-08-12: Electron main이 Product Compiler callable workflow를 build-time import한다. CLI text
  parsing과 native addon은 선택하지 않는다.
- 2026-08-12: Main은 filesystem dialog/path/session/cleanup capability를 소유하고 renderer에는 narrow typed
  API와 display data만 제공한다.
- 2026-08-12: Project save는 compiler-owned whole-directory atomic transaction으로 구현한다. Renderer나
  main에 schema-specific JSON writer를 복제하지 않는다.
- 2026-08-12: Export validator는 Studio에서도 항상 실행한다. Phase 1C.2는 local Windows product path의
  신뢰 가능한 UX이지 fast-but-unvalidated preview export가 아니다.
- 2026-08-12: 추가 third-party dependency와 native addon을 도입하지 않는다.

## 완료 기록

2026-08-12에 Phase 1C.2를 Windows x64 repository-local 범위에서 Complete/PASS로 닫았다.

- Product Compiler format/lint/typecheck는 PASS, built-in test는 52/52 PASS다.
- Studio format/lint/typecheck와 production build는 PASS, built-in test는 10/10 PASS다. Final source-audit
  remediation 뒤 production output은 renderer 21 modules/209.50 kB JS/12.70 kB CSS, main 16 modules/53.39 kB,
  preload 3 modules/5.07 kB다.
- Actual ProductService Debug/Release smoke는 각각 temp physical `.garak`의
  new→validate→save→reopen에서 saved/reopened true, field parity와 immutable Product ID를 확인한 뒤 reference
  project를 열어 exact three-file bundle과 moduleinfotool create/validate, inspector, official Validator
  standard/extensive child 5/5 exit 0을 검증했다. 두 run 모두 cleanup warning은 0이다.
- Product Runtime Debug/Release는 각각 `--fresh` configure와 `--clean-first` 177/177 build, no-native-build
  runner와 CTest 7/7을 통과했다. Build artifact manifest는 Debug 772개, Release 641개가 불변이었고
  forbidden native build invocation은 0이다.
- Bounded `pnpm studio:dev` launch는 Vite ready와 Electron process 4개를 확인한 뒤 정확한 process tree를
  중지했다. 이는 사람이 실제 DAW나 packaged installer를 조작한 검증으로 일반화하지 않는다.
- Studio direct dependency 16개와 Product Compiler runtime third-party dependency 0을 유지했다. Renderer
  bundle과 boundary audit에서 filesystem/shell/process/raw IPC capability leak를 허용하지 않았다.

실패와 remediation도 PASS evidence와 분리해 보존한다.

- 첫 composite native command는 `cmd`/PowerShell quoting 때문에 intended sequence를 증명하지 못해 PASS
  evidence에서 제외했다. Configure/build, runner와 CTest를 exact command로 분리해 다시 실행했다.
- Sandbox의 Vite 및 native child process spawn은 `EPERM`으로 실패했다. 같은 source와 exact command를
  승인된 환경에서 다시 실행해 Studio build와 ProductService Debug/Release export를 통과했다.
- 일부 pnpm wrapper 실행은 non-TTY auto-verification 문제로 중단됐다. Existing frozen toolchain의
  official quality/test script를 다시 실행해 최종 52/52 PASS를 얻었고 installed Prettier direct check로
  closeout Studio instruction formatting도 확인했다.
- 첫 workflow smoke 호출은 `pnpm studio:verify:product-workflow -- --configuration Debug`의 literal `--`가
  script에 전달되어 usage error로 export 전에 종료됐다. Exact
  `pnpm --dir studio verify:product-workflow --configuration Debug`와 Release 명령으로 교정해 둘 다
  통과했다.
- Final source audit는 response SHA guard가 canonical uppercase를 강제하지 않고, export success가
  processor/controller FUID를 표시하지 않으며, draft edit/new export 시 이전 result가 남는 세 문제를 발견했다.
  Guard/UI state를 수정한 뒤 final production build를 다시 실행해 PASS했다.

## 다음 단계

Roadmap의 정확한 다음 milestone은 **Phase 2 — Project Evolution and Persistent Migration**이다. 별도
승인과 ExecPlan 전에는 착수하지 않는다. macOS/AU/DAW/signing/notarization/installer는 첫 상용 배포 전
cross-platform release gate로 유지하며 이번 Windows PASS로 일반화하지 않는다.
