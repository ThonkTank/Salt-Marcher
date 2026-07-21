Status: Active Target
Owner: SaltMarcher Team
Last Reviewed: 2026-07-22
Source of Truth: GM-visible consistency, failure, and history behavior for
cross-feature live-campaign operations.

# Live Campaign Runtime Requirements

## Goal

Keep consequential live-campaign changes understandable and safe while the GM
runs several Scenes and their Encounters. A user-confirmed Encounter outcome
must never apply only some of its consequences. Party changes remain immediately
authoritative even when dependent runtime contexts need a visible retryable
reconciliation. Meaningful campaign events remain chronologically traceable.

## Scope And Terms

- Every running Encounter belongs to exactly one running Scene.
- Several Scenes and their Encounters may be running at the same time.
- An affected Scene is a running Scene that references the changed Party
  character. Only affected Scenes and their Encounters require reconciliation.
- `pending` means the authoritative source change is durable but one dependent
  runtime context has not yet accepted that exact source revision.

## Non-Goals

- closing a running Scene when its Encounter is completed
- including loot persistence in the Encounter outcome
- reconstructing or restoring the complete live campaign at an arbitrary past
  point
- using the campaign history as the write model for current state
- recording drafts, previews, UI interaction, Encounter-builder edits, Scene
  notes, or other ordinary workspace changes as campaign events

## Encounter Outcome

The Encounter result surface provides one explicit confirmation for the complete
selected outcome. One confirmation changes all of the following together or
changes none of them:

- the Encounter becomes durably completed with that result
- the calculated XP award is applied to the eligible Party characters
- the selected named-NPC lifecycle and finite-stock consequences are applied to
  live World state
- one correlated campaign-history outcome is recorded

The associated Scene remains running. Before confirmation the GM may change the
selected World consequences. After a successful confirmation the same outcome
cannot be applied again.

If validation, storage, or any required owner is unavailable, the complete
confirmation fails without changing Encounter, Party, World, or campaign
history. The result surface remains available, explains the failure, and lets
the GM retry the same intent. A retry after an unknown response resolves to the
already committed result or applies it once; it never duplicates XP, losses,
stock consumption, completion, or history.

## Party Membership Reconciliation

A successful Party activation, deactivation, or deletion is authoritative
immediately and is not rolled back because a Scene or Encounter cannot be
updated.

- A newly active character appears unassigned and is not inserted into a Scene
  or Encounter automatically.
- Deactivation or deletion stops the character from being treated as a current
  Party member immediately.
- Every affected running Scene and its Encounter reconcile to the accepted Party
  revision. Unaffected running contexts do not change.
- Until both dependent contexts have accepted that revision, the affected Scene
  is visibly `pending`. Stale Encounter context must not be presented as
  synchronized and must not make the character count as a current Party fact.
- Initialization, refresh, and an explicit retry resume the saved reconciliation
  without repeating the Party mutation.

Failure to reconcile preserves the authoritative Party change and every already
valid independent runtime context. It must not silently present a mixed state as
synchronized.

## Campaign History

The GM can inspect one chronological campaign history containing meaningful
confirmed world consequences:

- campaign-time advances and completed travel segments
- completed Encounter outcomes and their XP and World consequences
- Party membership changes
- NPC lifecycle, finite-stock, resource, possession, and other confirmed live
  World consequences
- GM corrections to previously recorded campaign facts

Every entry identifies the initiating operation and applicable campaign-time
boundary, preserves enough historical label and outcome information to remain
understandable after referenced content is renamed or deleted, and may link to
current content when that content still exists.

Committed entries are immutable. A correction appends a new entry that points
to the corrected event and explains the resulting current fact; it does not
rewrite or remove history. The history is an explanatory record of confirmed
facts, not a complete command stream, replay source, or whole-campaign restore
facility.

## Acceptance Criteria

- one Encounter-outcome confirmation either changes Encounter, Party, selected
  World consequences, and campaign history together or changes none of them
- retrying the same completed Encounter outcome produces no duplicate effect
- a failed Encounter-outcome confirmation leaves the complete result available
  for retry and keeps its Scene running
- Party activation creates no automatic Scene assignment
- Party deactivation or deletion remains accepted when an affected Scene or
  Encounter is unavailable; only affected contexts become visibly pending
- pending runtime contexts never present stale membership as synchronized or
  use an inactive or deleted character as a current Party fact
- campaign history contains confirmed meaningful events and linked corrections,
  but excludes drafts and ordinary UI/workspace changes
- a historical event remains understandable after a referenced record is
  renamed or deleted
- no normal read, history view, correction, or recovery flow requires replaying
  the entire campaign history or restoring a global past snapshot

## References

- [Encounter Requirements](../../encounter/requirements/requirements-encounter.md)
- [Encounter Runtime State UI](../../encounter/requirements/requirements-encounter-state-tab.md)
- [Runtime Scene Requirements](../../scene/requirements/requirements-scene.md)
- [Party Dropdown Requirements](../../party/requirements/requirements-party-dropdown.md)
- [World Planner Requirements](../../worldplanner/requirements/requirements-world-planner.md)
- [Dungeon Needs Interview](../interviews/2026-07-20-dungeon-needs-interview.md)
