# Consolidated Party window

Confirmed 2026-09-12. This specification supersedes the historical Party and
Characters desktop surfaces, comparison controls, XP floor clamp and separate
rest meters described in earlier roadmap phases.

## Compact scene surface

One `party` window defaults to 360 × 220 px at the top right of the workspace.
Existing geometry survives. The window resizes to the existing minimum of
240 × 160 px and scrolls internally. Members initially collapse. Each first row
contains name, XP meter and rest meter with inline labels and no percentages.
The wrapping quick-information row is replaced by details when expanded.
All ten existing fields remain selectable: class, level, species, player,
armor class, speed in feet, passive perception, insight, investigation and
languages. Details also expose personal loot and the character catalog.

The existing frame title contains the party rest average, Undo, Redo and one
menu: Aktives Roster bearbeiten, Rasten, Verschieben, Schnellwerte. There is no
inner title bar, comparison, individual move, scene/member subtitle or permanent
status footer. Errors remain actionable when an operation fails.

## XP and rest

XP hover/focus states show total XP and the next level threshold, with explicit
missing-level and highest-level states. Progress is relative to the current
level floor. Clicking opens only amount, +, − and Übernehmen. The signed buttons
apply immediately; Übernehmen sets the total. Hover/focus previews and writes
use the same domain calculation. XP never falls below zero; every XP change
derives the corresponding level, including downward corrections. Manual XP
never changes consumed rest XP. Escape/outside click respect unresolved writes.

Rest uses daily budget B, long-rest consumption L, completed-section baseline A
and completed short sections k (0–2). The remaining frame is B−A, fill is
(L−A)/(B−A), and there are 3−k equal sections. The first two short rests close
one section at actual consumption L. A short rest at 20% leaves two equal
sections over the remaining 80%; the next mark corresponds to 60% total.
Further short rests clear short-rest consumption without advancing A or k.
Long rest clears consumption, A and k and establishes trustworthy baselines.
Exhausted budgets remain full and indicate a due long rest. Overruns stay
numerically visible in the tooltip.

The header averages individual remaining-frame fills without weighting. Unknown
or unreliable members are excluded and a partial basis is marked. Common marks
appear only for matching section counts. Unknown legacy section history retains
known daily consumption without inventing marks; unknown consumption or budget
has no asserted progress.

Rests select current scene members without search or selection-clear controls.
A second click on the same rest type confirms; selection, revision, scene and
dismissal invalidate that confirmation.

## Membership and destinations

The roster editor has fixed search (character/player/ID), selection count,
selection clear, a scrolling list and fixed apply controls. Filtering preserves
selection outside the visible results. Player, status and short ID distinguish
entries. Current scene members, inactive and unassigned members are eligible;
other scene members move through the separate shared action.

Shared move offers checkboxes, select all, and existing/new scene selection,
without search or selection-clear. New scenes require no name and inherit place
and time. Options use place plus membership, adding a stable short ID only for
collisions. Historical stored titles remain unchanged.

## Durable history

History keeps the latest 100 chronological actions per campaign and installation
across navigation, window closure and process restart. It includes manual XP,
rests, membership, moves with scene creation, quick fields, profile edits and
personal loot corrections. Navigation, filters, expansion and geometry add no
steps. New actions after undo discard the redo branch.

Campaign mutation, owner-scoped before/after facts and the command receipt are
atomic. An installation index and durable pending markers recover quick-field
writes across the two databases. An uncertain result must resolve its original
command before another attempt. Undo/redo have their own stable command IDs and
receipts, increment revisions and return current projections; original receipts
are immutable. Only affected fields are reversed, with explicit conflicts for
later incompatible edits. Combat and journey reconciliation is reversed in the
same campaign transaction. A newly created scene is removed only while unchanged
and unused; an opened new scene first requires returning to the source scene.
Loot history appends linked corrections without rewriting ledger history.
Quick-field guards inspect that setting alone. Imported/replaced campaigns
invalidate prior local history on the staged database.

## Migration and acceptance

Desktop document 6 upgrades all supported older versions. A sole Characters
window becomes Party with its geometry; if both existed, Party geometry wins,
the foremost joint stack position wins, and minimization requires both windows
to have been minimized. Closed windows stay closed; unrelated windows, map state
and reference history survive. Comparison settings are discarded deliberately.

Campaign schema 42 adds section metadata and campaign history. New characters
start with known three-section days; old section metadata remains untrusted
until a long rest. Installation schema 43 adds the local history index. Optional
projection fields and optional new-scene titles preserve old command receipts.

Acceptance covers 360/240 px layouts and accessible popups; all XP modes and
preview equality; early/extra/overdue/unknown rests and mixed averages; 45 roster
entries with search/filter retention; both move targets; history restart,
branching, conflicts, atomic rollback and uncertain-result recovery; and all
single/dual/closed/minimized desktop upgrade combinations.
