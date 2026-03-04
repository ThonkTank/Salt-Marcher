# Review Backlog — entities/

## [MEDIUM] CombatantState Temporary Field Cluster
**File:** src/entities/CombatantState.java:5-7
**Description:** Fields `CurrentHp`, `MaxHp`, `AC`, `CreatureRef`, and `InitiativeBonus` are only meaningful when `IsPlayerCharacter == false`. For PC combatants, `CombatSetup` writes zeros into `AC`, `MaxHp`, and `CurrentHp`, leaving `CreatureRef` null. This creates an implicit discriminated union where the type does not enforce valid invariants. Callers must manually guard with `!cs.IsPlayerCharacter` checks, creating risk of missed guards in future features (e.g., `CombatTrackerPane` lines 160, 213, 223, 250, 264, 295-296, 397).
**Suggested fix:** Split `CombatantState` into two separate thin structs (`PcCombatant` and `MonsterCombatant`), or make HP/AC `Optional<Integer>` and remove the boolean discriminator. Minimum first step: rename `IsPlayerCharacter` to `isPlayerCharacter` (Java conventions) and add Javadoc stating which fields are null/zero for PCs.
