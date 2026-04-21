package src.domain.encounter.published;

import java.util.List;
import java.util.Objects;

public record GenerateEncounterCommand(
        List<String> creatureTypes,
        List<String> creatureSubtypes,
        List<String> biomes,
        EncounterDifficultyBand targetDifficulty,
        int alternativeCount,
        EncounterGenerationTuning tuning,
        List<Long> excludedCreatureIds,
        List<EncounterLock> lockedCreatures
) {

    public GenerateEncounterCommand {
        creatureTypes = normalize(creatureTypes);
        creatureSubtypes = normalize(creatureSubtypes);
        biomes = normalize(biomes);
        targetDifficulty = targetDifficulty == null ? EncounterDifficultyBand.defaultBand() : targetDifficulty;
        alternativeCount = Math.max(1, Math.min(10, alternativeCount <= 0 ? 5 : alternativeCount));
        tuning = tuning == null ? EncounterGenerationTuning.defaultTuning() : tuning;
        excludedCreatureIds = excludedCreatureIds == null ? List.of() : List.copyOf(excludedCreatureIds);
        lockedCreatures = lockedCreatures == null ? List.of() : List.copyOf(lockedCreatures);
    }

    public GenerateEncounterCommand(
            List<String> creatureTypes,
            List<String> creatureSubtypes,
            List<String> biomes,
            EncounterDifficultyBand targetDifficulty,
            int alternativeCount,
            List<Long> excludedCreatureIds,
            List<EncounterLock> lockedCreatures
    ) {
        this(
                creatureTypes,
                creatureSubtypes,
                biomes,
                targetDifficulty,
                alternativeCount,
                EncounterGenerationTuning.defaultTuning(),
                excludedCreatureIds,
                lockedCreatures);
    }

    @Override
    public List<String> creatureTypes() {
        return List.copyOf(creatureTypes);
    }

    @Override
    public List<String> creatureSubtypes() {
        return List.copyOf(creatureSubtypes);
    }

    @Override
    public List<String> biomes() {
        return List.copyOf(biomes);
    }

    @Override
    public List<Long> excludedCreatureIds() {
        return List.copyOf(excludedCreatureIds);
    }

    @Override
    public List<EncounterLock> lockedCreatures() {
        return List.copyOf(lockedCreatures);
    }

    private static List<String> normalize(List<String> values) {
        if (values == null || values.isEmpty()) {
            return List.of();
        }
        return List.copyOf(values.stream()
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(value -> !value.isEmpty() && !"Any".equalsIgnoreCase(value))
                .distinct()
                .toList());
    }
}
