Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-26
Source of Truth: Global source-reference mirroring, extraction, citation, and
decision-evidence rules for external and local sources used by agents.

# Source References Standard

## Purpose

This verification standard defines how SaltMarcher proves that source-backed
claims were based on preserved evidence rather than on uncited public URLs,
memory, or silently transformed extracts.

`references/` is the global local reference
mirror. It is intentionally outside this repository and must not be copied into
project-local reference mirror folders.

`references/` is not a staging area for
product import corpora, production database source material, generated catalog
inputs, or other runtime data sources. Keep those in a dedicated local data
cache or the owning production-data location, and cite their concrete local
path when they inform a decision.

## Verified Sources

This document governs proof for:

- external-source-backed architecture, requirements, contract, domain,
  delivery, verification, tooling, prompt, and review claims
- local repository files cited as evidence for SaltMarcher decisions
- readable extracted mirrors kept under
  `references/<topic>/`
- original preserved source files kept under the global mirror tooling roots or
  topic folders

This document does not redefine the meaning of the cited architecture or
feature documents. It defines only the proof route for showing that a cited
source was locally preserved and auditable.

## Verification Methods

SaltMarcher accepts the following proof methods for source-backed claims:

- `Local Mirror Presence`
  External-source claims are proved by a preserved original plus a readable
  extracted local text under the global reference mirror.
- `Metadata Completeness`
  The readable extracted text proves provenance by naming `Original URL`,
  `Local Source`, `Source Kind`, and `Accessed`.
- `Direct Local Evidence Citation`
  Local repository files are proved by direct repo-path citations rather than
  by copied mirror extracts.
- `Review Inspection`
  Review confirms that extracts remain original-faithful and that project docs
  cite the correct local evidence route for the claim.

## Pass Or Fail Criteria

A source-backed claim passes this verification standard only when all relevant
criteria below are satisfied:

- an external-source-backed claim cites a readable extracted source path under
  `references/`
- the extracted source identifies its original source through the required
  metadata
- the cited local original path exists at the location recorded in the extract
  metadata, unless the original format is intentionally replaced by a more
  suitable preserved original in the same mirror family
- a local repository claim cites the concrete repo path directly instead of a
  synthetic mirror copy
- project documents keep quotations short and do not republish substantial
  third-party source text
- extracted source end files preserve the original meaning and do not summarize
  or editorialize the source

A claim fails this verification standard when any required local evidence path,
provenance field, or correct citation route is missing.

## Traceability Mapping

- External research claim -> readable extracted local text -> preserved original
  source -> optional public URL for human auditability
- Local repository claim -> concrete repo file path -> optional line-specific
  citation
- Review finding or handoff claim -> cited local evidence path that supports
  the assertion being made

## External Source Rules

When an agent uses an external source for research, architecture, behavior,
tooling, standards, prompt work, or review decisions:

- save the original source locally before relying on it for a decision
- prefer an HTML original under
  `references/.tools/html/<slug>.html`
- use `references/.tools/markdown/<slug>.md`
  only when the publisher provides source Markdown or the original is already
  Markdown
- keep PDFs or other binary originals in the most specific
  `references/<topic>/` folder when HTML is
  not the useful original form
- create or update a directly readable extracted text under
  `references/<topic>/<slug>.md`
- choose the topic folder by subject matter, not by the task that found the
  source
- do not store source originals under new top-level roots

The extracted text must start with source metadata:

- `Original URL`
- `Local Source`
- `Source Kind`
- `Accessed`

The extracted text is for local reading and decision support. It must preserve
the original source's content and meaning. Agents may edit extraction artifacts
only to restore readability when an automatic parser has distorted structure,
ordering, whitespace, navigation noise, or formatting. They must not summarize,
reinterpret, condense, editorialize, or semantically distance the source in the
`references/<topic>/` end result.

## Local Source Rules

Local repository sources do not need to be mirrored into
`references/`. When an agent uses a local
file, standard, ADR, source file, schema, or skill as evidence, cite the repo
path directly, with a line number when practical.

Do not copy local source files into reference extracts just to make a decision.
The repository file is already the local source.

Do not move product import corpora, production database source material, or
generated catalog inputs into
`references/`. They are local sources, not
reference mirrors.

## Maintenance Rules

- Keep one readable extracted file per source.
- Keep source filenames stable once referenced by a project decision.
- If a source is refreshed, update `Accessed` and preserve the
  decision-relevant metadata.
- If a topic folder becomes too broad, create a more specific topic folder and
  move only sources that share that subject.
- Do not commit third-party full-text mirrors unless the user explicitly
  approves that specific file for publication.
- Existing tracked reference notes may remain until they are deliberately
  migrated; new source mirrors follow this standard.

## Known Gaps And Review-Owned Proof

- review still owns whether the cited source actually supports the claim being
  made, beyond mechanical presence of a mirror path
- review still owns whether a readability repair preserved original meaning or
  crossed into summary or reinterpretation
- this document does not itself guarantee freshness of external sources; it
  guarantees preserved auditability of the consulted source
- local mirror presence is not proof that the resulting architecture or product
  decision is correct, only that the cited source route is auditable

## References

- [Documentation Standard](docs/project/architecture/documentation.md:1)
- [Layering Architecture Standard](docs/project/architecture/patterns/layering-architecture.md:1)
- [Agent Instruction Standard](docs/project/architecture/agent-instructions.md:1)
- [Source References Skill](tools/quality/skills/source-references/SKILL.md:1)
