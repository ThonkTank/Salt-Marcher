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

Direct profile-opening maintenance tools are not an alternate import
implementation. They must pass `openAuthorizedCampaignImportRuntime` with the
exact deployment-receipt SHA before constructing CampaignStore. Product calls
already execute through the compatible installed Utility process.
