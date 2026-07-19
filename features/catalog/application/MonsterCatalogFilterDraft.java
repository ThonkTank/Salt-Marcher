package features.catalog.application;

import features.encounter.api.EncounterPoolFilters;
import java.util.List;
import org.jspecify.annotations.Nullable;

/** Catalog-owned unfinished Monster filter input. */
public record MonsterCatalogFilterDraft(
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

    public MonsterCatalogFilterDraft {
        nameQuery = safe(nameQuery);
        challengeRatingMin = safe(challengeRatingMin);
        challengeRatingMax = safe(challengeRatingMax);
        sizes = copy(sizes);
        creatureTypes = copy(creatureTypes);
        creatureSubtypes = copy(creatureSubtypes);
        biomes = copy(biomes);
        alignments = copy(alignments);
        encounterTableIds = copy(encounterTableIds);
        worldFactionIds = copy(worldFactionIds);
        worldLocationId = Math.max(0L, worldLocationId);
    }

    public static MonsterCatalogFilterDraft empty() {
        return from(EncounterPoolFilters.empty());
    }

    public static MonsterCatalogFilterDraft from(EncounterPoolFilters filters) {
        EncounterPoolFilters safe = filters == null ? EncounterPoolFilters.empty() : filters;
        return new MonsterCatalogFilterDraft(
                safe.nameQuery(), safe.challengeRatingMin(), safe.challengeRatingMax(),
                safe.sizes(), safe.creatureTypes(), safe.creatureSubtypes(), safe.biomes(), safe.alignments(),
                safe.encounterTableIds(), safe.worldFactionIds(), safe.worldLocationId());
    }

    public EncounterPoolFilters toPoolFilters() {
        return new EncounterPoolFilters(
                nameQuery, challengeRatingMin, challengeRatingMax, sizes, creatureTypes,
                creatureSubtypes, biomes, alignments, encounterTableIds, worldFactionIds, worldLocationId);
    }

    public MonsterCatalogFilterDraft withNameQuery(String value) {
        return copy(value, challengeRatingMin, challengeRatingMax, sizes, creatureTypes, creatureSubtypes,
                biomes, alignments, encounterTableIds, worldFactionIds, worldLocationId);
    }

    public MonsterCatalogFilterDraft withChallengeRating(String minimum, String maximum) {
        return copy(nameQuery, minimum, maximum, sizes, creatureTypes, creatureSubtypes,
                biomes, alignments, encounterTableIds, worldFactionIds, worldLocationId);
    }

    public MonsterCatalogFilterDraft withSizes(List<String> values) {
        return copy(nameQuery, challengeRatingMin, challengeRatingMax, values, creatureTypes, creatureSubtypes,
                biomes, alignments, encounterTableIds, worldFactionIds, worldLocationId);
    }

    public MonsterCatalogFilterDraft withCreatureTypes(List<String> values) {
        return copy(nameQuery, challengeRatingMin, challengeRatingMax, sizes, values, creatureSubtypes,
                biomes, alignments, encounterTableIds, worldFactionIds, worldLocationId);
    }

    public MonsterCatalogFilterDraft withCreatureSubtypes(List<String> values) {
        return copy(nameQuery, challengeRatingMin, challengeRatingMax, sizes, creatureTypes, values,
                biomes, alignments, encounterTableIds, worldFactionIds, worldLocationId);
    }

    public MonsterCatalogFilterDraft withBiomes(List<String> values) {
        return copy(nameQuery, challengeRatingMin, challengeRatingMax, sizes, creatureTypes, creatureSubtypes,
                values, alignments, encounterTableIds, worldFactionIds, worldLocationId);
    }

    public MonsterCatalogFilterDraft withAlignments(List<String> values) {
        return copy(nameQuery, challengeRatingMin, challengeRatingMax, sizes, creatureTypes, creatureSubtypes,
                biomes, values, encounterTableIds, worldFactionIds, worldLocationId);
    }

    public MonsterCatalogFilterDraft withEncounterTables(List<Long> values) {
        return copy(nameQuery, challengeRatingMin, challengeRatingMax, sizes, creatureTypes, creatureSubtypes,
                biomes, alignments, values, worldFactionIds, worldLocationId);
    }

    public MonsterCatalogFilterDraft withFactions(List<Long> values) {
        return copy(nameQuery, challengeRatingMin, challengeRatingMax, sizes, creatureTypes, creatureSubtypes,
                biomes, alignments, encounterTableIds, values, worldLocationId);
    }

    public MonsterCatalogFilterDraft withLocation(long value) {
        return copy(nameQuery, challengeRatingMin, challengeRatingMax, sizes, creatureTypes, creatureSubtypes,
                biomes, alignments, encounterTableIds, worldFactionIds, value);
    }

    private static MonsterCatalogFilterDraft copy(
            String name,
            String minimum,
            String maximum,
            List<String> sizes,
            List<String> types,
            List<String> subtypes,
            List<String> biomes,
            List<String> alignments,
            List<Long> tables,
            List<Long> factions,
            long location
    ) {
        return new MonsterCatalogFilterDraft(
                name, minimum, maximum, sizes, types, subtypes, biomes, alignments, tables, factions, location);
    }

    private static String safe(@Nullable String value) {
        return value == null ? "" : value;
    }

    private static <T> List<T> copy(@Nullable List<T> values) {
        return values == null ? List.of() : List.copyOf(values);
    }
}
