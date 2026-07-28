# Party Architecture

Status: Active Godot target architecture
Owner: Party
Last Reviewed: 2026-07-28
Source of Truth: This document

## Purpose And Boundary

Party owns one Campaign Roster, its explicit current-Party subset, optional PC
profile facts, XP/rest progression, character-owned travel state, and
recoverable deletion. It does not own Session Planner's Planning Party, Scene
participation, authored dungeon/overworld maps, Adventuring Day presentation,
or Catalog browsing state.

The production shell exposes Party as a compact top-bar dropdown rather than a
navigation workspace. Presentation consumes immutable snapshots and sends
stable-identity commands; it does not own roster truth.

## Godot Source Shape

```text
godot/src/app/
  campaign_partition_command_controller.gd # shared admitted write lifecycle
godot/src/features/party/
  party_roster.gd                           # pure owner model and invariants
  party_adventuring_day.gd                  # pure budget/cadence/timeline rules
  adventuring_day_calculation_controller.gd # latest-wins CPU worker lane
  party_read_controller.gd                  # bounded latest-wins query lane
  party_command_controller.gd               # Party command vocabulary
godot/src/ui/
  party_top_bar.gd                          # compact dropdown and editor
  adventuring_day_top_bar.gd                # separate calculator dropdown
```

`PartyRoster` validates one complete `party` payload and applies mutations as
pure candidate-state transitions. Stable identity is independent of display
name. Name is the only required creation fact; player, level, passive
perception, and AC preserve exact absence. Creation and restore never activate
membership or invent travel participation.

`PartyCommandController` configures the shared Campaign partition command lane
with Party's empty payload and mutation vocabulary. Preparation runs off the
scene-tree thread, then the complete candidate is submitted to the serial
asynchronous Campaign writer under the captured activation and generation.
Switch, revoke, concurrent publication, or stale authority rejects the write.

`PartyReadController` resolves only the active Campaign and `party` partition,
runs a bounded filter off-thread, admits at most one active and one latest
pending request, and confirms the registry generation before publishing on the
scene-tree thread. Successful Campaign transitions notify the shell to queue a
fresh Party read, so the persistent trigger cannot retain the prior Campaign's
summary.

`PartyAdventuringDay` owns the level-budget table, per-character rest cadence,
group budget thirds, multi-day XP progress, grouped level-up breakpoints, and
ordered rest timeline. The automatic summary consumes the active Party snapshot
and fails closed when any active member lacks an authored level. Custom rows are
ephemeral presentation input and never enter the `party` partition.

Calculations use counted level cohorts rather than one expanded value per PC, so
content size is not capped by presentation rows. Published results identify the
local `dnd5e-2014` profile, normalized level/count and XP inputs, positive
half-up budget-third rounding, and ceiling division for equal XP shares.

`AdventuringDayCalculationController` runs pure calculations in one active plus
one latest-pending worker lane. Cancellation is cooperative at day boundaries;
only the latest epoch publishes. The UI bounds rendered timeline rows while the
calculation result remains complete.

## State And Consumer Boundaries

- `characters` is the live Roster; `trash` is the recoverable deletion set.
- `membership` defines the current Party and changes only by explicit command.
- travel state belongs to the PC and may reference foreign map identities
  without copying authored map truth.
- Party-token attachment is independent from a concrete map location.
- Planning Party is a Session Planner-owned set of stable character references;
  it resolves Party snapshots and never becomes Party write state.
- Encounter and Scene consumers eventually refresh through the public Party
  carrier boundary; they do not inspect partition JSON.

## Current Migration State

The native model, async read/write lanes, top-bar trigger, active cards, bounded
Roster search, name-only create, optional-field edit, explicit membership, XP
correction, Party rest, recoverable trash, restore, restart readback, and stale
read suppression are implemented. The separate native Rastbudget trigger,
active/custom level rows, budget/progress modes, rest cadence, grouped level-up
timeline, latest-wins calculation, and 1366 x 768 dropdown proof are also
implemented. Concrete travel commands, Scene integration, Planning Party
consumption, final `PartyApi` carriers, owner-visible acceptance, and legacy
Java/SQLite deletion remain.

## Permanent Constraints

- one Campaign owner partition named `party`;
- stable identity, duplicate-name support, and exact optional absence;
- no implicit current-Party, travel, Scene, or Planning Party participation;
- all mutation preparation and provider I/O remain off the scene-tree thread;
- calculation cost follows days and the fixed 20-level rule axis, not expanded
  character count; no presentation-defined character cap is allowed;
- one admitted Campaign writer determines publication order;
- restore preserves identity but clears active/transient participation;
- no JavaFX, Java, JDBC, SQLite, or service-locator dependency enters the Godot
  owner boundary.

## References

- [Party Domain Model](../domain/domain-party.md)
- [Party Persistence Contract](../contract/contract-party-persistence.md)
- [Party Dropdown Requirements](../requirements/requirements-party-dropdown.md)
- [Adventuring Day Dropdown Requirements](../requirements/requirements-adventuring-day-dropdown.md)
- [Adventuring Day Calculator Requirements](../requirements/requirements-adventuring-day-calculator.md)
- [Persistence Lifecycle](../../project/contract/persistence-lifecycle.md)
- [Feature Boundary Standard](../../project/architecture/patterns/feature-boundaries.md)
