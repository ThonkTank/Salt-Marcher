package src.domain.encounter.generation.value;

public final class EncounterCandidateProfile {

    private final long id;
    private final String name;
    private final String challengeRating;
    private final EncounterCandidateCombatStats combatStats;
    private final String role;

    EncounterCandidateProfile(
            long id,
            String name,
            String challengeRating,
            EncounterCandidateCombatStats combatStats,
            String role
    ) {
        this.id = id;
        this.name = name;
        this.challengeRating = challengeRating;
        this.combatStats = combatStats;
        this.role = role;
    }

    int xp() {
        return combatStats.xp();
    }

    long id() {
        return id;
    }

    String name() {
        return name;
    }

    String challengeRating() {
        return challengeRating;
    }

    String role() {
        return role;
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
