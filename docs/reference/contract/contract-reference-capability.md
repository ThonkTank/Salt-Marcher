# Reference Capability Contract

This document is normative for the renderer-to-utility reference boundary.

## Operations

`references.staticIndex`

- input: none
- output: immutable `ReferenceIndex` containing SRD, creature, trait, action,
  and legendary-action terms
- mode: read
- role: GM window

`references.campaignIndex`

- input: explicit Campaign ID, which must equal the utility process's active
  Campaign
- output: immutable `ReferenceIndex`
- mode: read
- role: GM window

`references.detail`

- input: one `ReferenceTarget`; campaign-owned targets resolve only in the
  utility process's active Campaign
- output: immutable `ReferenceDocument`
- mode: read
- role: GM window

All operations are declared in the shared operation table, validated by Zod
at preload and utility boundaries, and use the standard supervised request
deadline and typed capability failures.

## Boundary rules

- The preload exposes only these narrow methods and the validated
  `references:index-changed` notification with changed stable targets; it does not expose the
  artifact, filesystem, database, or a generic query facility.
- The utility process loads the local artifact and composes catalog and world
  owning services. Main owns no reference-domain behavior.
- Results are immutable projections. Renderer state may compile an index or
  cache detail promises, but cannot mutate reference truth.
- Campaign-owned targets resolve only through the active Campaign's owning
  services; the renderer cannot request cross-campaign resolution.
- Unknown, deleted, malformed, or unsupported targets fail through the shared
  typed error vocabulary; no placeholder domain object is fabricated.

## Imported source

The developer command `pnpm import:references` downloads the archive for the
checked-in `5e-database` commit and verifies its fixed SHA-256 before parsing.
It validates every source endpoint with its own schema, rejects duplicate
stable targets and creature-part ID collisions without explicit overrides,
pre-links the structured document AST, and writes the deterministic read-only
SQLite catalog and canonical creature catalog together with manifests, Golden
IDs, attribution, and quality reports. The command is
not callable through the application capability bridge. Packaging copies the
catalog as an Electron extra resource; runtime opens it read-only and requires
no network permission.
