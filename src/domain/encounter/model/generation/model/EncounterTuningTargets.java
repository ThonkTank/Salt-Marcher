package src.domain.encounter.model.generation.model;

public record EncounterTuningTargets(
        int targetCreatureCount,
        int creatureCountTolerance,
        int targetDistinctStatBlocks,
        int maxDistinctStatBlocks
) {
}
