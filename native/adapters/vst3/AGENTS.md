# Garak VST3 Adapter Rules

The repository and `native/AGENTS.md` rules apply here with these narrower adapter constraints.

- Keep every Steinberg type, include, lifecycle, and error code inside this directory or a
  VST3-only contract test. Do not expose VST3 types through a first-party public API.
- The audio `process` callback and every synchronous helper must not allocate, free, lock, wait,
  perform I/O, log, format strings, mutate bus structure, or propagate exceptions.
- Product Runtime v1 is editorless. Do not link VSTGUI or add views, resources, MIDI/event busses,
  sidechains, programs, meters, or other product features without an approved later ExecPlan.
- Product ID-derived processor/controller FUIDs and Gain/Bypass numeric IDs are persistent
  contracts. Never regenerate or reuse released IDs.
- Do not edit, format, analyze, or apply Garak warning flags to `third_party/vst3sdk` source.
- The VST3 factory and SDK-owned parameter container require transfer of a freshly allocated
  reference-counted object through a raw ABI pointer. Direct `new` is allowed only at those
  explicit SDK ownership-transfer sites.
- Keep automatic plugin links disabled. Validate repository-local exported Warm/Bright bundles
  with the exact `moduleinfotool`, first-party inspector, and official validator built by the
  matching Product Runtime configuration.
