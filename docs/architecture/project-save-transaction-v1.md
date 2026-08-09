# Garak Persistence Transaction v1

## Managed layout

For a physical target `<parent>/<name>.garak`:

```text
<parent>/.garak-persistence/<target-key>/
  lock.json
  transactions/<transaction-id>/manifest.json

<parent>/.garak-backups/<target-key>/<transaction-id>/
  backup.json
  <name>.garak/
```

The existing inner atomic writer may temporarily own `.garak-project-stage-*` and `<name>.garak.garak-backup-*` siblings. Their exact relative names are recorded in the outer manifest.

## Manifest fields

The strict manifest records type/version, transaction and inner transaction IDs, operation, target key and leaf, Product ID, source/candidate/backup fingerprints, source/candidate schema versions, phase, and exact managed relative artifact paths.

## Phases

- `prepared`: lock and manifest exist; backup may still be incomplete.
- `backup-verified`: persistent backup exactly matches the source.
- `candidate-published`: canonical candidate exists at the final path.
- `committed`: publication was verified and cleanup may finish.

## Mutation order

1. Recover an earlier transaction or fail closed.
2. Load and validate the source.
3. Verify Product ID and expected tree revision.
4. Acquire the physical-target lock.
5. Recheck the source under the lock.
6. Record `prepared`.
7. Copy and verify the persistent backup.
8. Record `backup-verified`.
9. Call the existing canonical stage/publish transaction.
10. Verify candidate fingerprint, Product ID, and current schema.
11. Record `candidate-published`, then `committed`.
12. Remove transaction-owned temporary artifacts and release the lock.

The persistent verified backup remains.
