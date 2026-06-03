package src.domain.encounter.model.generation;

public final class EncounterCandidateProfile {

    private final EncounterCreatureFacts facts;
    private final EncounterCandidateCombatStats combatStats;
    private final EncounterRole role;
    private final int selectionWeight;

    public static EncounterCandidateProfile fromFacts(EncounterCreatureFacts candidate) {
        return fromFacts(candidate, 1);
    }

    public static EncounterCandidateProfile fromFacts(EncounterCreatureFacts candidate, int selectionWeight) {
        EncounterRole role = EncounterRoleClassification.classify(candidate).role();
        return new EncounterCandidateProfile(
                candidate,
                EncounterCandidateCombatStats.fromFacts(candidate),
                role,
                selectionWeight);
    }

    public EncounterCandidateProfile(
            EncounterCreatureFacts facts,
            EncounterCandidateCombatStats combatStats,
            EncounterRole role,
            int selectionWeight
    ) {
        this.facts = facts;
        this.combatStats = combatStats;
        this.role = role == null ? EncounterRole.standardRole() : role;
        this.selectionWeight = Math.max(1, Math.min(10, selectionWeight));
    }

    public int xp() {
        return combatStats.xp();
    }

    public long id() {
        return facts.id();
    }

    public String name() {
        return facts.name();
    }

    public EncounterRole role() {
        return role;
    }

    public EncounterCreatureFacts facts() {
        return facts;
    }

    public int selectionWeight() {
        return selectionWeight;
    }

    public EncounterCandidateCombatStats combatStats() {
        return combatStats;
    }
}
