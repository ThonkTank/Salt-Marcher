---
name: source-references
description: Use before researching, planning, implementing, reviewing, or documenting with any external source or local source evidence. Requires agents to use the global evidence mirror at `/home/aaron/Schreibtisch/projects/references/`, read from extracted local text, and cite concrete local paths for source-backed decisions.
---

# Source References

## Overview

Use this skill whenever source material affects a claim or decision. The global
source of truth for preserved external evidence is:

- `/home/aaron/Schreibtisch/projects/references/`
- `/home/aaron/Schreibtisch/projects/references/index.md`

This skill applies to external web pages, PDFs, documentation, articles,
standards, package docs, and local repository files used as evidence.

`/home/aaron/Schreibtisch/projects/references/` is an evidence mirror, not a
staging area for product import corpora, production database source material,
generated catalog inputs, or runtime data sources. Keep runtime data in the
owning project location and cite its concrete local path when it informs a
decision.

## Required Workflow

Before relying on an external source:

1. Check whether a readable extracted source already exists under
   `/home/aaron/Schreibtisch/projects/references/<topic>/`.
2. If not, preserve the original under
   `/home/aaron/Schreibtisch/projects/references/.tools/html/` by default.
3. Use `/home/aaron/Schreibtisch/projects/references/.tools/markdown/` only for
   original Markdown, and keep binary originals in the specific topic folder
   when HTML is not useful.
4. Create or update the readable extracted text at
   `/home/aaron/Schreibtisch/projects/references/<topic>/<slug>.md`.
5. Include `Original URL`, `Local Source`, `Source Kind`, and `Accessed` in the
   extracted text.
6. Preserve the source content and meaning. Edit only to fix parser distortion,
   navigation noise, broken ordering, whitespace, or formatting that blocks
   direct reading.
7. Make decisions from the local extracted text, not from an unpreserved browser
   page or transient search snippet.
8. If the original already exists locally, continue from that preserved original;
   do not create a link stub, a TODO note, or a second placeholder file instead
   of producing the readable extract.
9. A readable extract must contain directly readable source content. Metadata
   pages, citation pages, landing pages, BibTeX-only pages, and abstract-only
   mirrors are not finished references.
10. If the current source only provides metadata or an abstract, try to obtain a
    source that contains the original text before adding it to the mirror.
11. If the original text is not actually accessible, including on the web, do not
    keep that source as a reference entry. Ignore it instead of mirroring a
    metadata-only placeholder.

Before relying on a local source:

1. Read the repo file directly.
2. Cite the repo path and line number when practical.
3. Do not mirror repo files into `/home/aaron/Schreibtisch/projects/references/`.
4. Do not move product import corpora, production database source material, or
   generated catalog inputs into the reference mirror; cite their local path
   directly.

## Citation Rules

When documenting or handing off a source-based decision:

- cite the readable extracted source under
  `/home/aaron/Schreibtisch/projects/references/<topic>/`
- cite the preserved original path from that extracted source's `Local Source`
  metadata
- include the original URL when a reader may need to audit the source outside
  the local mirror
- cite local repo evidence by direct repo path
- summarize source content in project language instead of copying long passages
  into decision documents

Do not use a summary, paraphrase, or interpretation as the reference end file.
That file must remain an original-faithful extracted source.

A public URL alone is not enough for an external source that influenced a
decision.

An abstract page, citation export, or bibliography entry alone is also not
enough.

## Review Focus

When reviewing source-backed work, check for:

- external claims without a global mirror path
- decisions based on an unsaved browser result or transient search snippet
- extracted reference files without source metadata
- original files saved outside `.tools/` without a format reason
- project documents that blur third-party source text with project policy
- reference end files that summarize, reinterpret, or semantically rewrite the
  original source
- citations to local repo facts that omit the file path
- metadata-only or abstract-only reference entries presented as if they were
  readable full texts
- ignored-source candidates that should have been dropped because no original
  text was actually accessible

## References

- `/home/aaron/Schreibtisch/projects/references/index.md`
- `/home/aaron/Schreibtisch/projects/references/local-project-evidence.md`
