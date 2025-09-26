# Documentation Style Guide

## Purpose & Audience
This guide defines the mandatory structure and formatting standards for READMEs, overview documents, and wiki pages in the Salt Marcher project. It targets contributors, reviewers, and maintainers who create or update documentation.

## Directory Map
| Path | Description | Primary Docs |
| --- | --- | --- |
| `docs/README.md` | Repository documentation hub that links every major knowledge area. | [`docs/README.md`](README.md) |
| `docs/style-guide.md` | This style guide describing required sections and formatting rules. | _This document_ |

## Key Workflows
1. **Plan the document scope:** Identify the audience (contributors, users, or stakeholders) and determine which folders or features the document covers.
2. **Apply the template:** Populate each section below in order. Use consistent headings (`##`) and keep descriptions concise but actionable.
3. **Build the directory map table:** List relevant folders (or files, if necessary) in a three-column table. Include direct links to the authoritative documentation for each entry.
4. **Cross-link related materials:** In the Linked Docs section, surface upstream/downstream references so readers can continue their journey without searching the repository.
5. **Document standards:** Capture naming conventions, coding guidelines, testing expectations, or workflow agreements that apply to the scope of the document.

## Linked Docs
- [Repository documentation hub](README.md) – overview of all documentation entry points.
- [Salt Marcher plugin overview](../salt-marcher/overview.md) – example of the template applied to the plugin package.
- [Root README](../README.md) – repository-level application of this style guide.

## Standards & Conventions
Every README, overview, or wiki page must include the following sections in the listed order:

1. **Purpose & Audience** – Describe why the document exists and who should read it.
2. **Directory Map** – Provide a table with three columns: `Path`, `Description`, and `Primary Docs`. Scope the table to the directories (or files) relevant to the document. Use inline links in the `Primary Docs` column to point at deeper documentation.
3. **Key Workflows** – Outline the principal tasks or processes a reader should follow. Bulleted or numbered lists are acceptable; keep steps outcome-oriented.
4. **Linked Docs** – Curate a short list of related documentation, prioritizing wiki articles, subsystem READMEs, diagrams, or API references that complement the current document.
5. **Standards & Conventions** – Summarize the rules, naming schemes, testing expectations, or collaboration agreements that govern the document's scope.

Additional formatting rules:
- Use Markdown headings (`#`, `##`, `###`) consistently; avoid skipping levels.
- Prefer relative links inside the repository to keep navigation consistent across forks and mirrors.
- When referencing command sequences or configuration snippets, use fenced code blocks with language hints for readability.
- Update directory tables and linked references whenever files move to prevent dead links.
