# ADR 0008 — Durable Project Persistence and Recovery Policy

- Status: Accepted
- Date: 2026-08-22
- Scope: Windows x64 repository-local Studio and Product Compiler

## Context

Phase 2A made editable project migration deterministic, but the Phase 1C save path still used a temporary backup that was deleted after publication. A process termination after the source directory had moved could therefore leave the project missing until a person manually found the temporary artifact.

## Decision

Garak treats the user's `.garak` directory as the authoritative source. Studio opens it through an opaque main-process session and stores a deterministic tree fingerprint. Destructive save and explicit in-place migration require the same physical target, Product ID, and expected fingerprint.

Each destructive mutation uses a sibling, same-volume persistence area with:

- an atomic exclusive lock;
- a versioned transaction manifest;
- a deterministic candidate fingerprint;
- a persistent, verified full-project backup;
- the existing atomic stage/publish implementation;
- deterministic recovery before the next open or save.

The current save implementation remains the canonical publisher. The persistence layer wraps it rather than introducing a second file writer.

## Conflict policy

Garak refuses to overwrite when the source has changed, disappeared, changed Product ID, moved to another physical object, or advanced to an unsupported schema. A remaining lock without a valid manifest and multiple unresolved transactions fail closed for later user review.

## Recovery policy

Recovery infers only states proven by fingerprints:

- source fingerprint present: abort the interrupted mutation;
- candidate fingerprint present: complete the commit;
- target missing or invalid with a verified backup: restore the backup;
- any other combination: return an ambiguous recovery error without deleting artifacts.

Persistent backups are not pruned in Phase 2B.1.

## Migration policy

Opening a legacy project never rewrites it. Explicit in-place v1→v2 migration uses the Phase 2A pure migration, requires a verified v1 backup, and preserves Product ID, VST3 FUIDs, and Parameter IDs.

## Guarantee boundary

This policy covers ordinary exceptions, failed publication, and process interruption discoverable on the next invocation. It does not claim full durability against storage-controller loss, filesystem corruption, or incomplete hardware flush semantics.

## Consequences

- Studio's renderer remains unable to access files, locks, manifests, or backup paths.
- Backups consume disk space until a later retention policy is accepted.
- Phase 2B.2 must provide migration, conflict, and ambiguous-recovery UX without weakening these fail-closed rules.
