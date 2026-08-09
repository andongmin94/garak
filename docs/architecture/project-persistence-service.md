# Project Persistence Service

## Purpose

The persistence service is a main-owned wrapper around the existing canonical project writer. It adds revision, locking, persistent backup, and recovery without duplicating project serialization.

## Public operations

- `openDurableProductProject`: recover a provable interrupted transaction, then return the current project with a tree revision.
- `createDurableProductProject`: serialize through the existing writer while holding a physical-target lock.
- `saveDurableProductProject`: verify the open revision and Product ID, retain a verified backup, then publish the canonical v2 candidate.
- `migrateProductProjectInPlace`: explicitly publish the Phase 2A v1→v2 canonical result with a legacy backup.
- `recoverProductPersistence`: resolve one transaction only when source, candidate, or backup fingerprints prove the result.

## Tree revision v1

The revision hashes the sorted package inventory. Each regular file contributes its normalized relative UTF-8 path, byte length, and exact bytes. Absolute path, timestamps, machine identity, and enumeration order are excluded. Symbolic links, junction entries, unsupported file types, package escape, and case-colliding names are rejected.

## Physical identity

A persistence target key is SHA-256 over a normalized resolved physical target path. The project source remains a regular `.garak` directory. Managed persistence and backup directories are siblings of the source, never children of it.

## Security boundary

Only Electron main and first-party compiler services own paths and transaction state. Renderer requests continue to carry opaque document capabilities and drafts, not arbitrary filesystem operations.
