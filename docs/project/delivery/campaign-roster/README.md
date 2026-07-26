Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-26
Process Pin: A-0.3.3 at 5bb2841be32f30c9185f346578cf5bc785fe6196
Candidate Base: fb229a119d1c64dbf15282a3608576334c607007
Source of Truth: Temporary delivery state for the Campaign Roster slice.

# Campaign Roster Slice

## Acceptance

This slice implements canonical `AC-F10` through the production application.
Each Campaign exposes one Roster containing every independently identified PC.
The GM can create a PC with only a name, create namesakes, edit or clear every
optional authored fact, switch Campaigns, restart, and recover the exact Roster.
Creation never adds the PC to the current Party or a Running Scene. Product
behavior remains owned by the [Program Capability
Requirements](../../requirements/requirements-program-capabilities.md).

## Entry Decision

The live product currently requires level, passive Perception, and Armor Class,
prepopulates invented defaults, and creates a character as an active Party
member. That production journey is the causal negative control. The accepted
Campaign isolation from M1 is the only entry prerequisite. Current Party/Scene
transitions, broader Campaign-object lifecycle, and reusable knowledge are not.

The existing Party capability may continue to own the aggregate and store, but
Roster management must have a distinct production surface and projection.
Character creation becomes Roster-only; Party activation remains a separate
explicit action. Optional absence is represented directly, never as a sentinel
or compatibility adapter. Pre-completion persistence is disposable, so the
current schema may be replaced without conversion, migration, fallback, or
dual-format support.

## Practical Proof

First retain a failing production-route journey showing that name-only creation
is rejected or silently activates Party membership. The repaired journey then:

1. creates a name-only PC and two namesakes through the real UI;
2. edits and clears every optional fact by stable identity;
3. proves current Party IDs, travel participation, and Scene membership are
   unchanged;
4. switches between two Campaigns repeatedly, restarts, and visibly reopens the
   exact independent Rosters; and
5. injects persistence/publication failure and observes old-or-new truth with no
   false revision.

Direct-current-v1 SQLite readback must preserve null optional facts and stable
IDs without a legacy path. A fresh evaluator replays the frozen production
journey and its causal control. Exit also requires focused diagnostics, literal
green `./gradlew check`, installed-artifact proof, zero independent severe
findings, required PR CI, and merge. Personal interaction acceptance remains
part of M13's final integrated owner test.

## Safety And Exclusions

- Do not modify unknown or real local data; automated proof uses temporary
  Campaigns only.
- Do not add pre-completion compatibility or preserve invented defaults.
- Do not implement Party/Scene activation reconciliation, planning Party,
  complete character sheets, deletion, import/export, or M2b knowledge.
- Reopen the aggregate/store split only if practical evidence shows the shared
  owner cannot preserve distinct Roster and Party semantics.

On exit this file is deleted; durable behavior remains in canonical owners.
