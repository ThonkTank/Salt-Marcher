package features.encounter.domain.generation;

public record EncounterTuningTargets(
        int targetCreatureCount,
        int creatureCountTolerance,
        int targetDistinctStatBlocks,
        int maxDistinctStatBlocks
) {
}
