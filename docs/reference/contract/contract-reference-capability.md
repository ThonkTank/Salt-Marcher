# Reference Capability Contract

This document is normative for the renderer-to-utility reference boundary.

## Operations

`references.index`

- input: none; campaign-owned terms use the utility process's active Campaign
- output: immutable `ReferenceIndex`
- mode: read
- role: GM window

`references.detail`

- input: one `ReferenceTarget`; campaign-owned targets resolve only in the
  utility process's active Campaign
- output: immutable `ReferenceDocument`
- mode: read
- role: GM window

Both operations are declared in the shared operation table, validated by Zod
at preload and utility boundaries, and use the standard supervised request
deadline and typed capability failures.

## Boundary rules

- The preload exposes only these two narrow methods; it does not expose the
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

The developer command `pnpm import:references` downloads the pinned SRD source
set, normalizes it deterministically, records a manifest and content hash, and
writes the checked-in generated artifact. The command is not callable through
the application capability bridge. The shipped application reads only that
artifact and therefore requires no runtime network permission.
