Status: Active
Owner: Aaron (Product Owner)
Last Reviewed: 2026-07-10
Source of Truth: What is documented where in SaltMarcher, how documents link to
each other, and how any piece of recorded intent can be found again later.

# SaltMarcher Documentation Specification

## 1. Purpose

This specification defines the complete documentation system for SaltMarcher.
It is designed greenfield: it describes how documentation *should* work, not
how it historically grew. Every document in the repository must have exactly
one home defined by this specification. A document that has no home here is
either deleted or this specification is amended first.

The system exists to answer four questions at any time, for any reader
(owner, agent, or judge), in under one minute of navigation:

1. **Why does this project exist?** → Vision layer
2. **What are we building next, and what later?** → Direction layer
3. **How exactly must a given feature behave?** → Behavior layer
4. **How do we know it behaves that way?** → Proof layer

## 2. Principles

- **P1 — Intent, not state.** Documentation records what *should* be true.
  What *is* true lives in code, tests, and harnesses. No document may contain
  "current state" prose; such prose drifts and duplicates machine truth.
- **P2 — One home per fact.** Every fact has exactly one owning document.
  All other mentions are links, never copies.
- **P3 — Chain of custody.** Every implemented behavior must be traceable
  along an unbroken link chain: Vision → Roadmap entry → Issue → Requirement →
  Proof. A break in the chain is a defect.
- **P4 — Findable by index, not by memory.** Every directory has a README
  index. Every document is reachable from `docs/README.md` in at most three
  clicks. Nothing relies on a reader already knowing a filename.
- **P5 — Prose only where machines cannot prove.** Anything a checker,
  harness, or CI gate enforces mechanically is not additionally described in
  prose beyond a one-line pointer to the gate.
- **P6 — Owner-facing German, repo-facing English.** Interview transcripts and
  owner readbacks are German. All repository documents are English.
- **P7 — Verbatim before interpretation.** When owner intent is captured, the
  owner's words are recorded verbatim first. Any rephrasing into repo English
  is marked as interpretation and requires explicit owner confirmation.

## 3. Document Size & Focus

Completeness outranks brevity; focus outranks both. A document may never lose
owner-relevant facts to satisfy a size rule. Focus is achieved by cutting scope,
never by cutting content: a document that grows too large is split along topic
seams into focused documents. A 500-line document about one topic is healthy; a
300-line document about three topics is defective.

Every document's `Source of Truth` front-matter sentence is its contract.
Content belongs in exactly the document whose contract covers it. If no
contract covers a fact, a new document is created and indexed. "The document is
full" is never a valid reason to relocate, omit, or compress a fact.

Size is a signal, never a gate:

- **Soft threshold (400 lines):** crossing it requires a linked `doc-split`
  issue in the same change. Writing continues unblocked.
- **No hard cap:** no size check may fail a build or block a documentation
  write by length alone.
- **Split invariant:** every split preserves all facts, gives each successor a
  disjoint `Source of Truth` sentence, and updates inbound links plus directory
  indexes in the same change.

The cheap compliant path must be the correct path: write the fact where it
belongs, file a split issue if the threshold is crossed, and keep moving. Any
policy under which omission or scatter is cheaper than writing correctly is a
policy defect.

## 4. The Five Layers

| Layer | Question answered | Location | Change frequency | Written by |
|---|---|---|---|---|
| L0 Vision | Why does SaltMarcher exist? For whom? What is it *not*? | `docs/project/vision.md` | Rarely (quarterly at most) | Owner via interview, agent transcribes |
| L1 Direction | What now, what next, what later? | `docs/project/roadmap.md` | Monthly-ish | Owner decides, agent maintains |
| L2 Backlog | What concrete problems and wishes exist? | GitHub Issues | Continuously | Owner or agent files; templates enforce shape |
| L3 Behavior | How must feature X behave, precisely? | `docs/<feature>/requirements/` | Per accepted issue | Agent drafts, judge approves, owner accepts |
| L4 Proof | How is that behavior proven? | `docs/<feature>/verification/` + harnesses | With every behavior change | Agent, mechanically gated |

Layers L3 and L4 already exist in the repository and are adopted unchanged in
structure. Layers L0–L2 are new. Layer L2 deliberately lives *outside*
`docs/` — issues are working inventory, not documentation; only what survives
into L3 becomes documentation.

### 4.1 L0 — Vision (`docs/project/vision.md`)

Target length: one focused page, normally about 600 words. If the vision needs
more content, preserve the facts and split or restructure only by topic.
Mandatory sections:

- **Users** — who SaltMarcher serves (and explicitly who it does not).
- **Jobs** — the concrete jobs it does at and around the game table, each as
  one sentence in the form "A GM can …".
- **Non-Goals** — what SaltMarcher will never be. This section filters future
  feature ideas and is the most-referenced part of the document.
- **Quality Bar** — the two or three qualities that outrank all features
  (e.g. local-first, zero-setup, table-speed responsiveness).

Every roadmap entry must be justifiable by pointing at a Job or Quality Bar
item. An idea that cannot be linked to the vision is rejected or the vision is
consciously amended (which is an ADR-worthy decision).

### 4.2 L1 — Direction (`docs/project/roadmap.md`)

A single file with exactly three sections: **Now**, **Next**, **Later**.
No dates, no versions, no promises. Rules:

- Every entry is one sentence plus a link to exactly one GitHub issue.
- **Now** holds at most 3 entries. An entry enters Now only when its issue has
  owner-confirmed acceptance criteria.
- New ideas always enter as an issue linked under **Later**, never directly
  into Now. This is the mechanism that turns "features when they occur to me"
  into recorded, ordered intent without losing spontaneity.
- Completed entries are deleted from the roadmap (their history lives in the
  closed issue and the journal), keeping the file permanently one screen long.

### 4.3 L2 — Backlog (GitHub Issues)

Issues are the only inbox for ideas, bugs, and UX problems. The existing
German issue templates are the enforced shape. Additional rules:

- An idea issue states a **problem or wish**, never a solution design.
  Solution design happens at L3 when the issue is promoted.
- Promotion to **Now** requires the issue to carry an
  **Acceptance Criteria** section: 3–8 testable owner-language sentences
  ("Wenn …, dann …"). These are written with the owner in German and are the
  contract for the L3 requirements delta.
- Labels: `idea`, `bug`, `ux`, plus one feature label matching a
  `docs/<feature>/` directory. The feature label is what makes issues findable
  from the feature's README (see §5).

### 4.4 L3 — Behavior (`docs/<feature>/requirements/`)

Adopted from the existing structure with one greenfield correction:

- Requirements documents contain **only target behavior**: Goal, Non-Goals,
  Primary Surfaces, Primary User Flows, Acceptance Criteria. The historical
  "Current State" sections are removed and banned (P1).
- Each requirement paragraph carries a stable anchor ID in the form
  `REQ-<feature>-<slug>` (e.g. `REQ-hex-travel-token-readback`) so proofs and
  issues can reference it precisely and permanently.
- Every requirements change references the issue that caused it in the
  document's change footer: `Derived from: #<issue>`.

### 4.5 L4 — Proof (`docs/<feature>/verification/`)

Adopted unchanged in structure. Two rules restated for the chain of custody:

- Every `REQ-…` ID must appear in exactly one verification document, mapped to
  a mechanically executable proof (harness, checker, or explicitly
  `Owner-Verified Behavior` for things only the owner can judge).
- A `REQ-…` ID without a proof mapping fails the documentation gate.

## 5. Cross-Cutting Document Types

| Type | Location | Purpose | Rule |
|---|---|---|---|
| Decisions (ADR) | `docs/project/decisions/` | Irreversible or expensive-to-reverse choices, incl. vision amendments | Numbered, immutable once accepted, superseded not edited |
| Journal | `docs/project/journal/` | What happened when; operational history | Append-only, monthly files, never referenced as a source of truth |
| Architecture | `docs/project/architecture/` | Structural rules agents must obey | Only rules that are *not* mechanically enforced; everything enforced is a one-line pointer to its gate (P5) |
| Interviews | `docs/project/interviews/` | Verbatim owner-intent capture (German) | Raw transcripts, append-only; the *only* documents allowed in German; source material for L0–L3, never themselves a source of truth |
| Definition of Done | `docs/project/definition-of-done.md` | The single project-wide DoD checklist | ~10 lines; referenced from the PR template; no per-feature DoDs |

## 6. Findability Rules

- **F1 — Index chain.** `docs/README.md` lists the five layers and all feature
  directories with one-line purposes. Every `docs/<feature>/README.md` lists
  that feature's documents *and* links its open issues via the feature label
  query. No document exists that is not listed in its directory README.
- **F2 — Naming.** Filenames follow `<type>-<feature>[-<slug>].md`, lowercase,
  hyphenated, stable for the document's lifetime. Renames require updating all
  inbound links in the same commit.
- **F3 — Stable anchors.** Facts that will be referenced (requirements,
  decisions) carry IDs (`REQ-…`, `ADR-NNNN`). Links target IDs, not prose,
  so documents can be reorganized without breaking references.
- **F4 — Three-click rule.** Any document must be reachable from
  `docs/README.md` within three links. If a document needs a fourth level of
  nesting, the structure is wrong.
- **F5 — Front matter.** Every document starts with `Status`, `Owner`,
  `Last Reviewed`, `Source of Truth` (one sentence naming what this document
  alone owns). Two documents claiming the same truth is a defect (P2).

## 7. Lifecycle

`Draft` -> `Active` -> `Deprecated`.

- **Draft**: content exists, owner has not confirmed. Agents may not build
  against Draft requirements.
- **Active**: owner-confirmed (for L0–L3) or judge-approved (architecture).
  The only status agents may implement against.
- **Deprecated**: replaced; the header names the successor. Deprecated files
  are deleted after one release cycle — the journal keeps history, the repo
  stays lean.

## 8. What Must Not Be Documented

- Current-state descriptions of code or UI (lives in code and harnesses).
- Anything a mechanical gate already enforces, beyond a pointer to the gate.
- Aspirational process documents without an owner and a consumer.
- Duplicate summaries "for convenience" — convenience is the index chain's job.

## 9. Definition of Done (project-wide)

A change is Done when:

1. It traces to an issue with owner-confirmed acceptance criteria.
2. The affected `requirements-*.md` reflects the target behavior (Active).
3. Every new/changed `REQ-…` ID is mapped in a verification document to a
   green mechanical proof, or explicitly to owner verification.
4. All quality gates are green.
5. The owner has behaviorally accepted the change.
6. The roadmap entry is removed and the issue is closed with a link to the
   requirement IDs it produced.

## 10. Conformance

This specification itself is enforced in layers, cheapest first:

- Mechanical: index completeness (F1), naming (F2), front matter (F5),
  REQ-to-proof mapping (§4.5) — extend the existing documentation gate.
- Judge: P1/P2/P5 violations (state prose, duplicated truth, ceremonial prose)
  are review findings that block merge.
- Owner: only L0 content, acceptance criteria, and behavioral acceptance.
  The owner is never asked to review structure — structure is machine- and
  judge-territory by design.
