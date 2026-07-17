package features.encounter.domain.generation;

import java.util.List;
import java.util.Map;

public record EncounterGenerationInputs(
        List<String> creatureTypes,
        List<String> creatureSubtypes,
        List<String> biomes,
        EncounterRequestedDifficulty targetDifficulty,
        EncounterTuningIntent tuning,
        List<Long> encounterTableIds,
        List<Long> worldFactionIds,
        long worldLocationId,
        String nameQuery,
        String challengeRatingMin,
        String challengeRatingMax,
        List<String> sizes,
        List<String> alignments,
        Map<Long, Integer> finiteCreatureStockCaps
) {

    public EncounterGenerationInputs(
            List<String> creatureTypes,
            List<String> creatureSubtypes,
            List<String> biomes,
            EncounterRequestedDifficulty targetDifficulty,
            EncounterTuningIntent tuning,
            List<Long> encounterTableIds,
            List<Long> worldFactionIds,
            long worldLocationId,
            Map<Long, Integer> finiteCreatureStockCaps
    ) {
        this(creatureTypes, creatureSubtypes, biomes, targetDifficulty, tuning,
                encounterTableIds, worldFactionIds, worldLocationId,
                "", "", "", List.of(), List.of(), finiteCreatureStockCaps);
    }

    public EncounterGenerationInputs {
        creatureTypes = creatureTypes == null ? List.of() : List.copyOf(creatureTypes);
        creatureSubtypes = creatureSubtypes == null ? List.of() : List.copyOf(creatureSubtypes);
        biomes = biomes == null ? List.of() : List.copyOf(biomes);
        targetDifficulty = targetDifficulty == null
                ? EncounterRequestedDifficulty.autoDifficulty()
                : targetDifficulty;
        tuning = tuning == null ? EncounterTuningIntent.autoIntent() : tuning;
        encounterTableIds = encounterTableIds == null ? List.of() : List.copyOf(encounterTableIds);
        worldFactionIds = worldFactionIds == null ? List.of() : List.copyOf(worldFactionIds);
        worldLocationId = Math.max(0L, worldLocationId);
        nameQuery = nameQuery == null ? "" : nameQuery.trim();
        challengeRatingMin = challengeRatingMin == null ? "" : challengeRatingMin.trim();
        challengeRatingMax = challengeRatingMax == null ? "" : challengeRatingMax.trim();
        sizes = sizes == null ? List.of() : List.copyOf(sizes);
        alignments = alignments == null ? List.of() : List.copyOf(alignments);
        finiteCreatureStockCaps = finiteCreatureStockCaps == null ? Map.of() : Map.copyOf(finiteCreatureStockCaps);
    }

    public static EncounterGenerationInputs empty() {
        return new EncounterGenerationInputs(
                List.of(),
                List.of(),
                List.of(),
                EncounterRequestedDifficulty.autoDifficulty(),
                EncounterTuningIntent.autoIntent(),
                List.of(),
                List.of(),
                0L,
                "",
                "",
                "",
                List.of(),
                List.of(),
                Map.of());
    }
}
