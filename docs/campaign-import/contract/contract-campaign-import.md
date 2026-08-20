# Campaign import contract

Campaign import is a Utility-process capability. The public operations are
`campaignImport.validate`, `campaignImport.preview`, and
`campaignImport.apply`; all inputs and immutable outputs cross the same Zod
operation registry as other capabilities.

`CampaignImportBundle` V1 is a full, reviewable source image and declares all
four V1 sections: Party, Locations, Factions, and NPCs. Its export hash is
the canonical SHA-256 fingerprint of the bundle with `source.exportHash` set to
64 zeroes. Source ID and monotonically increasing revision identify its history.
Every party member, location, faction, and NPC has an external key. Species and
language normalization and all NPC statblock, location, and faction mappings
are represented in the resolution manifest by stable source paths and reason
codes.

Preview reports stable conflict codes for malformed bundles, hash mismatch,
duplicate external keys or display names, missing decisions, unknown
statblocks/references, regressed revisions, and changed content under a reused
revision. A report with conflicts cannot be applied.

Apply writes a fresh campaign database under the CampaignStore staging root.
It persists provenance and external-key mappings, reads Party, Location,
Faction, and NPC aggregates back through their domain stores, and requires
SQLite `quick_check`. Only then does CampaignStore expose and activate the new
image. Failed staging leaves the recorded active campaign and its directory
unchanged. Identical bundles return `unchanged`; a newer source image replaces
the prior imported image at the same campaign ID after verification.

Publishing is delegated to the shared persisted Campaign lifecycle:
`staged -> validated -> swapped -> reopened -> registered -> verified ->
finalized`. The lifecycle coordinator, not the import service, owns filesystem
rename, connection reopen, the atomic Campaign/import registry commit, registry
readback, rollback/roll-forward, and cleanup. Import specializes staging with
its adapters and specializes post-publish verification with provenance,
aggregate readbacks, and the staged Campaign fingerprint. Its installation
saga is durable audit evidence and reconciles receipts created before the
shared lifecycle; it is not a second owner of Campaign publication.

A process exit before the atomic registry commit rolls back to the previous
validated Campaign. A commit marker makes recovery roll forward, but the old
directory remains recoverable until the new store and both registry projections
read back successfully. Recovery and cleanup are idempotent after every
persisted lifecycle phase.

Direct profile-opening maintenance tools are not an alternate import
implementation. They must pass `openAuthorizedCampaignImportRuntime` with the
exact deployment-receipt SHA before constructing CampaignStore. Product calls
already execute through the compatible installed Utility process.
