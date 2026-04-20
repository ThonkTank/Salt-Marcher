package src.domain.encounter.generation.value;

public final class EncounterCandidateProfile {

    private final EncounterCreatureFacts facts;
    private final EncounterCandidateCombatStats combatStats;
    private final String role;

    public EncounterCandidateProfile(
            EncounterCreatureFacts facts,
            EncounterCandidateCombatStats combatStats,
            String role
    ) {
        this.facts = facts;
        this.combatStats = combatStats;
        this.role = role;
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

    public String challengeRating() {
        return facts.challengeRating();
    }

    public String role() {
        return role;
    }

    public EncounterCreatureFacts facts() {
        return facts;
    }

    public int hitPoints() {
        return combatStats.hitPoints();
    }

    public int armorClass() {
        return combatStats.armorClass();
    }

    public int initiativeBonus() {
        return combatStats.initiativeBonus();
    }

    public int legendaryActionCount() {
        return combatStats.legendaryActionCount();
    }
}
