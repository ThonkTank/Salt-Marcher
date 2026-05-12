package src.domain.encounter.model.generation.model;

public final class EncounterCandidateProfile {

    private final EncounterCreatureFacts facts;
    private final EncounterCandidateCombatStats combatStats;
    private final String role;
    private final int selectionWeight;

    public EncounterCandidateProfile(
            EncounterCreatureFacts facts,
            EncounterCandidateCombatStats combatStats,
            String role
    ) {
        this(facts, combatStats, role, 1);
    }

    public EncounterCandidateProfile(
            EncounterCreatureFacts facts,
            EncounterCandidateCombatStats combatStats,
            String role,
            int selectionWeight
    ) {
        this.facts = facts;
        this.combatStats = combatStats;
        this.role = role;
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

    public String role() {
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
