package features.encounter.api;

import java.util.List;
import org.jspecify.annotations.Nullable;

/** Catalog-owned creature and source constraints used by Encounter generation. */
public record EncounterPoolFilters(
        String nameQuery,
        String challengeRatingMin,
        String challengeRatingMax,
        List<String> sizes,
        List<String> creatureTypes,
        List<String> creatureSubtypes,
        List<String> biomes,
        List<String> alignments,
        List<Long> encounterTableIds,
        List<Long> worldFactionIds,
        long worldLocationId
) {

    public EncounterPoolFilters {
        nameQuery = normalized(nameQuery);
        challengeRatingMin = normalized(challengeRatingMin);
        challengeRatingMax = normalized(challengeRatingMax);
        sizes = copy(sizes);
        creatureTypes = copy(creatureTypes);
        creatureSubtypes = copy(creatureSubtypes);
        biomes = copy(biomes);
        alignments = copy(alignments);
        encounterTableIds = copy(encounterTableIds);
        worldFactionIds = copy(worldFactionIds);
        worldLocationId = Math.max(0L, worldLocationId);
    }

    public static EncounterPoolFilters empty() {
        return new EncounterPoolFilters("", "", "", List.of(), List.of(), List.of(), List.of(), List.of(),
                List.of(), List.of(), 0L);
    }

    private static String normalized(@Nullable String value) {
        return value == null ? "" : value.trim();
    }

    private static <T> List<T> copy(@Nullable List<T> values) {
        return values == null ? List.of() : List.copyOf(values);
    }
}
