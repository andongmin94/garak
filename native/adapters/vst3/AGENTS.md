# Garak VST3 Adapter Rules

The repository and `native/AGENTS.md` rules apply here with these narrower adapter constraints.

- Keep every Steinberg type, include, lifecycle, and error code inside this directory or a VST3-only
  contract test. Do not expose VST3 types through `garak_core` or another first-party public API.
- The audio `process` callback and every synchronous helper must not allocate, free, lock, wait,
  perform I/O, log, format strings, mutate bus structure, or propagate exceptions.
- Keep the Gain Spike editorless. Do not link VSTGUI or add views, resources, MIDI/event busses,
  sidechains, programs, meters, or other product features.
- The fixed processor/controller FUIDs and Gain/Bypass numeric IDs are persistent spike evidence.
  Never regenerate them during configure or build.
- Do not edit, format, analyze, or apply Garak warning flags to `third_party/vst3sdk` source.
- The VST3 factory and SDK-owned parameter container require transfer of a freshly allocated
  reference-counted object through a raw ABI pointer. Direct `new` is allowed only at those explicit
  SDK ownership-transfer sites; it remains forbidden for first-party ownership elsewhere.
- Keep automatic plugin links disabled. Validate only the bundle under the selected `out/build/`
  directory with `tools/vst3/validate.ps1`.
