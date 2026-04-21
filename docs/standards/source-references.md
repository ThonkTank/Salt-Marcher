Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-04-21
Source of Truth: Local source-reference mirroring, extraction, citation, and
decision-evidence rules for external and local sources used by agents.

# Source References Standard

## Goal

SaltMarcher decisions must be traceable to the sources that informed them
without republishing third-party source text. Agents may use external sources
and local repository sources, but any decision based on them must cite a stable
local path and clearly separate the source material from SaltMarcher's
interpretation.

`docs/references/` is the local reference mirror. It is intentionally ignored by
Git and must not be pushed to public repositories unless the user explicitly
approves a specific source file that is safe to publish.

`docs/references/` is not a staging area for product import corpora,
production database source material, generated catalog inputs, or other runtime
data sources. Keep those in a dedicated local data cache or the owning
production-data location, and cite their concrete local path when they inform a
decision.

## External Source Rules

When an agent uses an external source for research, architecture, behavior,
tooling, standards, prompt work, or review decisions:

- save the original source locally before relying on it for a decision
- prefer an HTML original under `docs/references/.tools/html/<slug>.html`
- use `docs/references/.tools/markdown/<slug>.md` only when the publisher
  provides source Markdown or the original is already Markdown
- keep PDFs or other binary originals in the most specific
  `docs/references/<topic>/` folder when HTML is not the useful original form
- create or update a directly readable extracted text under
  `docs/references/<topic>/<slug>.md`
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
`docs/references/<topic>/` end result.

## Local Source Rules

Local repository sources do not need to be mirrored into `docs/references/`.
When an agent uses a local file, standard, ADR, source file, schema, or skill as
evidence, cite the repo path directly, with a line number when practical.

Do not copy local source files into reference extracts just to make a decision.
The repository file is already the local source.

Do not move product import corpora, production database source material, or
generated catalog inputs into `docs/references/`. They are local sources, not
reference mirrors.

## Decision Citation Rules

Whenever a decision, standard, ADR, feature document, implementation note,
review finding, or handoff claim depends on a source:

- cite the readable extracted source path under `docs/references/`
- cite the local original path from the extracted source metadata
- include the original URL when the document needs human auditability outside
  the local machine
- cite local repo evidence with the concrete repo path instead of a
  `docs/references/` mirror
- keep quotations short and prefer paraphrase or summary in project documents

A bare public URL is not enough when the source affected a SaltMarcher
decision. The local mirror path is the evidence that the exact consulted source
was preserved.

## Maintenance Rules

- Keep one readable extracted file per source.
- Keep source filenames stable once referenced by a project decision.
- If a source is refreshed, update `Accessed` and preserve the decision-relevant
  metadata.
- If a topic folder becomes too broad, create a more specific topic folder and
  move only sources that share that subject.
- Do not commit third-party full-text mirrors unless the user explicitly
  approves that specific file for publication.
- Existing tracked reference notes may remain until they are deliberately
  migrated; new source mirrors follow this standard.

## Review Rules

Reviewers must flag:

- decisions based on external sources without a local source path
- readable extracts that do not identify the original source
- source originals saved outside `docs/references/.tools/` without a clear
  format reason
- project documents that copy substantial third-party text instead of citing
  the local reference
- source-based claims that cite only a public URL when a local mirror was
  required
- reference end files that summarize or semantically rewrite the source instead
  of preserving an original-faithful extracted text

## References

- [Documentation Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/documentation.md:1)
- [Repository Structure Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/repository-structure.md:1)
- [Agent Instruction Standard](/home/aaron/Schreibtisch/projects/SaltMarcher/docs/standards/agent-instructions.md:1)
- [Source References Skill](/home/aaron/Schreibtisch/projects/SaltMarcher/tools/quality/skills/source-references/SKILL.md:1)
