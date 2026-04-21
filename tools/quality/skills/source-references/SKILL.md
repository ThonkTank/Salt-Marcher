---
name: source-references
description: Use before researching, planning, implementing, reviewing, or documenting with any external source or local source evidence. Requires agents to mirror external sources under `docs/references/`, read from extracted local text, and cite local source paths for decisions according to `docs/standards/source-references.md`.
---

# Source References

## Overview

Use this skill whenever source material affects a SaltMarcher claim or
decision. The canonical source of truth is
`docs/standards/source-references.md`; this skill operationalizes that standard
for agent work.

This skill applies to external web pages, PDFs, documentation, articles,
standards, package docs, and local repository files used as evidence.

## Required Workflow

Before relying on an external source:

1. Check whether a readable extracted source already exists under
   `docs/references/<topic>/`.
2. If not, save the original under `docs/references/.tools/html/` by default.
3. Use `docs/references/.tools/markdown/` only for original Markdown, and keep
   binary originals in the specific topic folder when HTML is not useful.
4. Create or update the readable extracted text at
   `docs/references/<topic>/<slug>.md`.
5. Include `Original URL`, `Local Source`, `Source Kind`, `Accessed`, and a
   short why-it-matters note in the extracted text.
6. Preserve the source's content and meaning in the extracted text. Edit only
   to fix parser distortion, navigation noise, broken ordering, whitespace, or
   formatting that blocks direct reading.
7. Make decisions from the local extracted text, not from an unpreserved browser
   page.

Before relying on a local source:

1. Read the repo file directly.
2. Cite the repo path and line number when practical.
3. Do not mirror the repo file into `docs/references/`.

## Citation Rules

When documenting or handing off a source-based decision:

- cite the readable extracted source under `docs/references/<topic>/`
- cite the preserved original path from that extracted source's `Local Source`
  metadata
- include the original URL when a reader may need to audit the source outside
  the local mirror
- cite local repo evidence by direct repo path
- summarize source content in SaltMarcher language instead of copying long
  passages in decision documents

Do not use a summary, paraphrase, or interpretation as the
`docs/references/<topic>/` reference end file. That file must remain an
original-faithful extracted source.

A public URL alone is not enough for an external source that influenced a
decision.

## Review Focus

When reviewing source-backed work, check for:

- external claims without a local mirror path
- decisions based on an unsaved browser result or transient search snippet
- extracted reference files without source metadata
- original files saved outside `docs/references/.tools/` without a format
  reason
- project documents that blur third-party source text with SaltMarcher policy
- reference end files that summarize, reinterpret, or semantically rewrite the
  original source
- citations to local repo facts that omit the file path

## Publication Rule

`docs/references/` is a local mirror and is ignored by Git to avoid publishing
third-party text. Do not stage or push full-text external source mirrors unless
the user explicitly approves that specific file for publication.

## References

- [Source References Standard](../../../../docs/standards/source-references.md)
- [Documentation Standard](../../../../docs/standards/documentation.md)
- [Agent Instruction Standard](../../../../docs/standards/agent-instructions.md)
- [AGENTS.md](../../../../AGENTS.md)
