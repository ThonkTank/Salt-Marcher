package src.domain.encounter.model.generation.helper;

record EncounterTuningTargets(
        int targetCreatureCount,
        int creatureCountTolerance,
        int targetDistinctStatBlocks,
        int maxDistinctStatBlocks
) {
}
