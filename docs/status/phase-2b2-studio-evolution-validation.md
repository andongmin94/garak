# Phase 2B.2 Studio project evolution validation

## Result

Implementation complete on `main`; final status depends on the exact Windows TypeScript/Studio gates for the commit containing this document.

## Implemented behavior

- Legacy schema-v1 open prompts for Open Read-Only or Back Up & Upgrade.
- Upgrade uses the durable Phase 2B.1 in-place migration and refuses completion without a verified backup summary.
- Declined migration leaves the source untouched and ordinary Save remains blocked.
- External revision, future-schema, Product-ID, lock, and recovery diagnostics are explained through bounded native dialogs.
- Ambiguous recovery creates no writable Studio session and deletes no artifact.
- Renderer Node.js, filesystem, shell, process, and raw IPC access remain absent.
- No new runtime or development dependency was added.

## Required gates

- `pnpm product:format:check`
- `pnpm product:lint`
- `pnpm product:typecheck`
- `pnpm product:test`
- `pnpm studio:format:check`
- `pnpm studio:lint`
- `pnpm studio:typecheck`
- `pnpm studio:test`
- `pnpm studio:build`
- existing Native and export regression gates

## Explicit non-scope

No recovery browser, manual source/backup arbitration, backup pruning, autosave recovery prompt, new IPC channel, single-file `.garak`, compiled/state v2, DSP graph, custom editor, macOS/AU, installer, signing, or notarization.
