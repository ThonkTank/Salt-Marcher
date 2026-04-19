package src.domain.encounter.generation;

public final class EncounterCandidateProfile {

    final long id;
    final String name;
    final String challengeRating;
    final EncounterCandidateCombatStats combatStats;
    final String role;

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
