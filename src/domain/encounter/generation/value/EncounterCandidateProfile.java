package src.domain.encounter.generation.value;

public final class EncounterCandidateProfile {

    private final EncounterCreatureFacts facts;
    private final EncounterCandidateCombatStats combatStats;
    private final String role;

    EncounterCandidateProfile(
            EncounterCreatureFacts facts,
            EncounterCandidateCombatStats combatStats,
            String role
    ) {
        this.facts = facts;
        this.combatStats = combatStats;
        this.role = role;
    }

    int xp() {
        return combatStats.xp();
    }

    long id() {
        return facts.id();
    }

    String name() {
        return facts.name();
    }

    String challengeRating() {
        return facts.challengeRating();
    }

    String role() {
        return role;
    }

    EncounterCreatureFacts facts() {
        return facts;
    }

    int hitPoints() {
        return combatStats.hitPoints();
    }

    int armorClass() {
        return combatStats.armorClass();
    }

    int initiativeBonus() {
        return combatStats.initiativeBonus();
    }

    int legendaryActionCount() {
        return combatStats.legendaryActionCount();
    }
}
