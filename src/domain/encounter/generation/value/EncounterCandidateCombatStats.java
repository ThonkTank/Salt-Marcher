package src.domain.encounter.generation.value;

public record EncounterCandidateCombatStats(
        int xp,
        int hitPoints,
        int armorClass,
        int initiativeBonus,
        int legendaryActionCount
) {

    public static EncounterCandidateCombatStats fromFacts(EncounterCreatureFacts candidate) {
        return new EncounterCandidateCombatStats(
                candidate.xp(),
                candidate.hitPoints(),
                candidate.armorClass(),
                candidate.initiativeBonus(),
                candidate.legendaryActionCount());
    }
}
