Status: Active
Source of Truth: What is documented where in SaltMarcher, the required header
metadata, and how any piece of recorded intent is found again later.

# Documentation Standard

Every document has exactly one home defined here. A document with no home here
is either deleted, or this standard is amended first.

The system answers four questions for any reader (owner, agent, or judge) in
under a minute of navigation:

1. **Why does this project exist?** -> `docs/project/vision.md`
2. **What are we building next, and what later?** -> `docs/project/roadmap.md`
3. **How exactly must a feature behave?** -> `docs/<feature>/requirements/`
4. **How do we know it behaves that way?** -> `docs/<feature>/verification/`
   and the harnesses

## Principles

- **P1 Intent, not state.** Documentation records what *should* be true. What
  *is* true lives in code, tests, and harnesses. Current-state prose drifts and
  duplicates machine truth; prefer target behavior. Where implementation
  demonstrably lags intent, say so in one line and link the gap, rather than
  maintaining a parallel description of the code.
- **P2 One home per fact.** Every fact has exactly one owning document, named
  by that document's `Source of Truth` sentence. A topic may be *summarized*
  anywhere and *defined* in only one place; summaries link to the owner. If two
  documents disagree, the owner of that topic wins and the other is corrected.
- **P3 Traceable intent.** An implemented behavior should be traceable back to
  the intent that caused it: vision -> roadmap -> issue -> requirement -> proof.
  This is a review lens, not an ID-threading ceremony.
- **P4 Findable by index.** Every directory has a README index; every document
  is listed in it. Nothing relies on a reader already knowing a filename.
- **P5 Prose only where machines cannot prove.** Anything a checker, harness,
  or CI gate enforces mechanically is not additionally described in prose
  beyond a one-line pointer to the gate. A verification document that restates
  what a harness already asserts is a defect, not documentation.
- **P6 Owner-facing German, repo-facing English.** Interview transcripts and
  owner readbacks are German. All repository documents are English.
- **P7 Verbatim before interpretation.** Owner intent is recorded in the
  owner's words first. Rephrasing into repo English is marked as
  interpretation and requires explicit owner confirmation.

## Placement

Canonical documentation lives under `docs/`. Feature-owned truth goes under
`docs/<feature>/<type>/`; cross-feature or repo-wide truth under
`docs/project/<type>/`. A feature folder uses only the families it actually
owns -- there is no obligation to populate every type.

| Type | Owns |
| --- | --- |
| `requirements/` | Target behavior, UI-visible states, user flows, acceptance criteria |
| `domain/` | Domain truth, aggregate roots, ownership boundaries, invariants, derived state |
| `contract/` | Boundary, API, schema, and persistence contracts |
| `architecture/` | Structural boundaries, owners, and decisions |
| `verification/` | Proof routes: which harness owns which claim |
| `delivery/` | Temporary rollout notes; never canonical architecture |

Project-wide additions: `docs/project/decisions/` holds ADRs (one decision
each, immutable once accepted, superseded rather than edited; required for R1
architecture changes, dependency major upgrades, gate or tooling changes, and
release policy changes). `docs/project/journal/YYYY-MM.md` holds design notes
and incidents -- append-only, never a source of truth.
`docs/project/interviews/` holds verbatim German owner-intent capture -- source
material, never itself a source of truth. `AGENTS.md` holds project-wide agent
norms only, never feature designs.

Legacy roots (`docs/architecture/`, `docs/adr/`, `docs/standards/`,
`docs/compat/`, `docs/features/`) are non-canonical and mechanically rejected.

## Header Metadata

Every document starts with, in the first lines:

- `Status`: `Draft` (proposal or unconfirmed), `Active` (current, maintained),
  or `Deprecated` (superseded; the header names the successor).
- `Source of Truth`: one sentence naming what this document alone owns. Two
  documents claiming the same truth is a defect (P2).

`Owner` and `Last Reviewed` are optional review context, not required fields
and not gate inputs.

`Draft` marks content whose intent is not yet confirmed. It is a signal to the
reader, not a build block.

## Size and Splitting

Focus outranks brevity; a document may never lose owner-relevant facts to
satisfy a size rule. A 500-line document about one topic is healthy; a 300-line
document about three topics is defective.

Size is a signal, never a gate: files over 400 lines are reported by
`checkDocumentationEnforcement` and never fail it. Split when a document
carries several audiences or ownership boundaries -- not by line count. Every
split preserves all facts, gives each successor a disjoint `Source of Truth`,
and updates inbound links and directory indexes in the same change.

## Templates

Structural starting points, not mandatory forms. ADRs use
`docs/project/decisions/0000-template.md`.

| Type | Sections |
| --- | --- |
| Architecture standard | purpose; rules; allowed exceptions; enforcement notes; references |
| Feature spec | goal; non-goals; primary user flows; acceptance criteria; open questions |
| Domain | write model; aggregate roots and mutation entrypoints; derived state; domain-owned ports; ownership boundaries; invariants |
| UI | component purpose; visible surfaces; interactions; visible states |
| Persistence | root contract; schema ownership; migration and stability rules |
| Verification | which harness owns which claim; known gaps or review-owned proof |

## What Must Not Be Documented

- Current-state descriptions of code or UI (they live in code and harnesses).
- Anything a mechanical gate already enforces, beyond a pointer to the gate.
- Aspirational process documents without an owner and a consumer.
- Duplicate summaries "for convenience" -- that is the index chain's job.
- Operational bookkeeping that git history already records.

## Enforcement

Honest layering -- what actually blocks, and what is judgement:

- **Mechanical** (`checkDocumentationEnforcement`, part of `check`): the
  `Status` and `Source of Truth` header lines, legacy-root absence, source-tree
  Markdown ownership (`src/domain/<ctx>/DOMAIN.md` only), and a non-fatal size
  signal. Nothing else in this document is machine-checked.
- **Judge**: P1/P2/P5 violations -- state prose, duplicated truth, ceremonial
  prose, a verification doc that mirrors its harness -- are review findings.
  So are placement, link integrity, and conflicting truth.
- **Owner**: vision content and behavioral acceptance only. The owner is never
  asked to review structure.

Documentation-only proof is `git diff --check` plus any owner-named proof from
`AGENTS.md`. A PR that changes behavior, ownership, architecture, or
long-lived workflow updates the affected documentation in the same change.
