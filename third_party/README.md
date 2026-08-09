# Third-party dependencies

이 디렉터리는 Garak이 직접 소유하지 않는 source dependency의 provenance와 notice 경계를
관리한다. Root repository의 license는 아직 정해지지 않았으며, 여기 있는 upstream license가
Garak 자체에 license를 부여하거나 선택한 것으로 해석되어서는 안 된다.

현재 dependency는 Phase 1A Windows VST3 기술 spike를 위한 공식 Steinberg VST3 SDK 하나다.
SDK superproject와 nested repository는 Git submodule의 exact commit으로 고정한다.

## 재현

Repository root에서 다음 명령으로 checkout을 초기화한다.

```text
git submodule update --init --recursive third_party/vst3sdk
git -C third_party/vst3sdk rev-parse HEAD
git -C third_party/vst3sdk describe --tags --exact-match HEAD
```

기대하는 SDK HEAD는 `9fad9770f2ae8542ab1a548a68c1ad1ac690abe0`, exact tag는
`v3.8.0_build_66`이다. `git submodule update --remote`는 사용하지 않는다.

## 원본 보존

- SDK와 nested repository source를 Garak style로 재포맷하거나 직접 수정하지 않는다.
- First-party warning, clang-format과 clang-tidy는 `third_party/`를 대상으로 삼지 않는다.
- Upstream 수정이 불가피해지면 먼저 별도 patch provenance와 검토 근거를 기록한다. 현재
  checkout에는 Garak patch가 없다.
- SDK example source는 Garak first-party source로 복사하지 않는다.

## Build와 link 경계

Checkout은 build 또는 link를 의미하지 않는다. Phase 1A는 SDK의 최소 processor/controller
interface와 official validator에 필요한 구성만 사용할 수 있다. `doc`, `tutorials`와 `vstgui4`는
checkout되어 있지만 Garak Gain Spike에 build하거나 link하지 않는다. 특히 VSTGUI support는
비활성화하며 VSTGUI target, source 또는 library를 plugin에 연결하지 않는다.

현재 파일은 dependency acquisition 시점의 사실을 기록한다. `base`와 `public.sdk`의 실제
compile/link 집합은 Phase 1A build의 compile database와 link command를 검증한 뒤 dependency
status에 확정해야 한다.

## 기록

- Machine-readable inventory: [dependencies.yml](dependencies.yml)
- License와 notice 경계: [notices/README.md](notices/README.md)
- Phase 1A 상태: [VST3 dependency status](../docs/status/phase-1a-vst3-dependency.md)
- Upstream SDK license: [VST3 SDK LICENSE.txt](vst3sdk/LICENSE.txt)

전체 transitive legal audit, 상용 배포 notice 구성과 trademark 검토는 아직 완료되지 않았다.

