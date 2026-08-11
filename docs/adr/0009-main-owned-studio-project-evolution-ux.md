# ADR 0009 — Main-owned Studio project evolution UX

- Status: Accepted
- Date: 2026-08-22
- Scope: Windows x64 repository-local Studio

## Context

Phase 2B.1 established durable save, verified backup, explicit in-place migration, and fail-closed recovery. Users still needed a bounded way to approve migration and understand why an external change or ambiguous recovery prevented a write.

A prior implementation attempted to add renderer-side migration and reload capabilities through a self-modifying GitHub Actions workflow. That path increased IPC surface and failed its TypeScript gate. It is removed rather than retained as a compatibility layer.

## Decision

Project evolution decisions remain owned by Electron main and `ProductService`.

- Opening a schema-v1 project presents a native choice: Open Read-Only or Back Up & Upgrade.
- Approval invokes the existing durable in-place migration service and requires a verified backup summary.
- Decline never rewrites the source and preserves the existing read-only legacy behavior.
- Save conflicts produce a native explanation and return the original structured diagnostic unchanged.
- Ambiguous recovery produces a native review-required explanation and creates no writable session.
- Renderer capabilities, filesystem authority, and IPC channel inventory remain unchanged.

## Consequences

The implementation is smaller than a renderer recovery panel and keeps all destructive decisions next to the filesystem authority. It does not provide manual recovery artifact selection, backup pruning, or autosave restoration; those require separate product decisions.
