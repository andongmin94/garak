# Project Backup and Recovery

## Verified backup

Every destructive current-project save and explicit in-place migration copies the complete source package to a managed sibling area before publication. The backup has its own operational manifest and is re-fingerprinted before the source can move.

Backups remain after success. Phase 2B.1 intentionally has no retention or pruning policy.

## Automatic recovery

Before open or save, Garak checks the physical target's transaction directory.

- A valid source matching the source fingerprint aborts an uncommitted transaction.
- A valid source matching the candidate fingerprint completes it.
- A missing or invalid target is restored from the verified backup.
- Different Product IDs, unexpected fingerprints, invalid backups, multiple transactions, or an orphan lock return a structured ambiguous-recovery failure.

Automatic recovery never chooses between two unrelated valid products and never deletes unmanaged paths.

## Limitations

The implementation can sync written manifest files and uses same-volume renames, but does not claim complete hardware power-loss durability. Packaged Studio recovery presentation, user choice for ambiguous cases, and backup retention belong to Phase 2B.2 or a later policy.
