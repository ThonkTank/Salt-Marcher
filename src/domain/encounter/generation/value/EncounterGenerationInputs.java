package src.domain.encounter.generation.value;

import java.util.List;

public record EncounterGenerationInputs(
        List<String> creatureTypes,
        List<String> creatureSubtypes,
        List<String> biomes,
        EncounterRequestedDifficulty targetDifficulty,
        EncounterTuningIntent tuning,
        List<Long> encounterTableIds
) {

    public EncounterGenerationInputs {
        creatureTypes = creatureTypes == null ? List.of() : List.copyOf(creatureTypes);
        creatureSubtypes = creatureSubtypes == null ? List.of() : List.copyOf(creatureSubtypes);
        biomes = biomes == null ? List.of() : List.copyOf(biomes);
        targetDifficulty = targetDifficulty == null
                ? EncounterRequestedDifficulty.autoDifficulty()
                : targetDifficulty;
        tuning = tuning == null ? EncounterTuningIntent.autoIntent() : tuning;
        encounterTableIds = encounterTableIds == null ? List.of() : List.copyOf(encounterTableIds);
    }

    public static EncounterGenerationInputs empty() {
        return new EncounterGenerationInputs(
                List.of(),
                List.of(),
                List.of(),
                EncounterRequestedDifficulty.autoDifficulty(),
                EncounterTuningIntent.autoIntent(),
                List.of());
    }
}
