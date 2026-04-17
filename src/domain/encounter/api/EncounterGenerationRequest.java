package src.domain.encounter.api;

import org.jspecify.annotations.Nullable;

import java.util.List;
import java.util.Objects;

public record EncounterGenerationRequest(
        List<String> creatureTypes,
        List<String> creatureSubtypes,
        List<String> biomes,
        EncounterDifficultyBand targetDifficulty,
        int alternativeCount,
        List<Long> excludedCreatureIds,
        List<EncounterLock> lockedCreatures
) {

    public EncounterGenerationRequest {
        creatureTypes = normalize(creatureTypes);
        creatureSubtypes = normalize(creatureSubtypes);
        biomes = normalize(biomes);
        targetDifficulty = targetDifficulty == null ? EncounterDifficultyBand.MEDIUM : targetDifficulty;
        alternativeCount = Math.max(1, Math.min(10, alternativeCount <= 0 ? 5 : alternativeCount));
        excludedCreatureIds = excludedCreatureIds == null ? List.of() : List.copyOf(excludedCreatureIds);
        lockedCreatures = lockedCreatures == null ? List.of() : List.copyOf(lockedCreatures);
    }

    private static List<String> normalize(List<String> values) {
        if (values == null || values.isEmpty()) {
            return List.of();
        }
        return values.stream()
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(value -> !value.isEmpty() && !"Any".equalsIgnoreCase(value))
                .distinct()
                .toList();
    }
}
