package src.domain.encounter.generation.value;

record EncounterCandidateCombatStats(
        int xp,
        int hitPoints,
        int armorClass,
        int initiativeBonus,
        int legendaryActionCount
) {

    static EncounterCandidateCombatStats fromFacts(EncounterCreatureFacts candidate) {
        return new EncounterCandidateCombatStats(
                candidate.xp(),
                candidate.hitPoints(),
                candidate.armorClass(),
                candidate.initiativeBonus(),
                candidate.legendaryActionCount());
    }
}
