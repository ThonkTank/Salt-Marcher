package src.domain.encounter.model.generation;

public record EncounterTuningTargets(
        int targetCreatureCount,
        int creatureCountTolerance,
        int targetDistinctStatBlocks,
        int maxDistinctStatBlocks
) {
}
