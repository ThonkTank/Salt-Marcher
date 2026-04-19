package src.domain.encounter.generation;

import src.domain.creatures.api.EncounterCandidate;

record EncounterCandidateCombatStats(
        int xp,
        int hitPoints,
        int armorClass,
        int initiativeBonus,
        int legendaryActionCount
) {

    static EncounterCandidateCombatStats fromCandidate(EncounterCandidate candidate) {
        return new EncounterCandidateCombatStats(
                candidate.xp(),
                candidate.hitPoints(),
                candidate.armorClass(),
                candidate.initiativeBonus(),
                candidate.legendaryActionCount());
    }
}
