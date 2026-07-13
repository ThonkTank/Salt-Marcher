Status: Draft
Owner: Aaron (Product Owner)
Last Reviewed: 2026-07-10
Source of Truth: How SaltMarcher epics are sliced into owner-testable
increments and how each slice travels to implemented, proven behavior.

# Slicing Protocol — From Epic to Slice to Implementation

## 1. Definitions

- **Epic:** A roadmap-level issue sized like a vision Job (e.g. encounter
  planning). Epics are never implemented directly.
- **Slice:** The smallest vertical increment of an epic that the owner can
  behaviorally test. A slice always ends in visible behavior and cuts through
  all layers (view → domain → data).
- **Slice test (binding):** *"After merge, can the owner do something new on
  screen and judge it in one acceptance session of roughly 15 minutes?"*
  If no: the slice is too large (cut further) or it is a layer, not a
  capability ("encounter data model" is not a slice; "search a monster and
  add it to the encounter" is). Size is never measured in lines or hours —
  those are proxy metrics; the acceptance session is the unit.

## 2. Stage 1 — Epic to slice plan

**Actor:** implementing agent proposes, judge reviews, owner confirms order.

1. The agent derives a slice list from the epic's owner-confirmed acceptance
   criteria, ordered by the walking-skeleton principle: the first slice is
   the thinnest end-to-end path through the feature; every later slice adds
   exactly one capability.
2. Every epic acceptance criterion maps to at least one slice; the mapping
   is recorded in the epic. Unmapped criteria block the plan.
3. Judge checklist for the plan:
   - every slice passes the slice test (vertical, owner-testable, one
     session);
   - no layer-only or architecture-only slice before behavior slices;
   - structural generalizations (shared catalogs, frameworks) are the *last*
     slices, built after several concrete usages exist;
   - slices are independently mergeable in the given order.
4. The owner receives a short German readback of the slice list and confirms
   or reorders. This is the owner's only touchpoint at this stage.
5. Slices become sub-issues labeled `slice`, each linking its parent epic.
   The epic body becomes a checklist of its slices. The roadmap stays at
   epic level.

**In-flight rule:** at most one slice per epic is in flight, mirroring the
one-in-flight discipline of the migration and doc-size ledgers.

## 3. Stage 2 — Slice to Active requirements

**Actor:** agent drafts, judge approves, owner confirms criteria only.

1. The slice inherits its acceptance criteria from the epic; gaps are closed
   with the owner in German ("Wenn …, dann …"), captured verbatim per the
   interview rules, and written into the slice issue.
2. The agent writes the requirements delta in the affected
   `requirements-*.md`: exactly one `REQ-…` ID per acceptance criterion,
   back-linked 1:1 to the slice issue (`Derived from: #<slice>`).
3. Where the slice touches architecture, the migration process applies
   unchanged: judge-approved design artifact with a concrete deletion list
   before any implementation.
4. **Hard gate:** implementation may not start before the requirements delta
   is Active. Behavior never precedes its recorded intent.

## 4. Stage 3 — Implementation to acceptance

1. Implement against the `REQ-…` IDs; map each ID to a mechanical proof in
   the verification documents; all quality gates green.
2. The agent generates the owner's German test checklist mechanically from
   the acceptance criteria ("Öffne X, klicke Y, du solltest Z sehen").
   The owner walks the checklist and either accepts or files observations.
3. Acceptance → slice issue closed with its REQ IDs, epic checklist ticked,
   next slice enters flight.
4. When all slice boxes are ticked, one final integration pass re-checks the
   epic's acceptance criteria as a whole; then the epic is closed and its
   roadmap entry deleted per the Definition of Done.

## 5. Owner surface (complete list)

The owner is involved exactly three times per epic, always in German, never
on technical questions:

1. Confirm or reorder the slice plan (once per epic).
2. Confirm acceptance criteria per slice (usually inherited; rarely 2–3
   clarifying questions).
3. Walk the generated test checklist per slice, plus the final epic pass.

Everything else — slicing, requirements wording, design, proofs, indexes —
is agent and judge territory.

## 6. Non-Goals

- No estimation, story points, or time boxing; the acceptance session is the
  only size signal.
- No horizontal slices (per-layer work items) as independent deliverables.
- No parallel slices within one epic.

## References

- [Documentation Specification](../documentation-specification.md)
- [Definition of Done](../definition-of-done.md)
- [Doc-Split Protocol](doc-split-protocol.md)
