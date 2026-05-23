package src.domain.creatures.published;

import java.util.List;
import org.jspecify.annotations.Nullable;

public record RefreshCreatureCatalogCommand(
        @Nullable String nameQuery,
        @Nullable String challengeRatingMin,
        @Nullable String challengeRatingMax,
        List<String> sizes,
        List<String> creatureTypes,
        List<String> creatureSubtypes,
        List<String> biomes,
        List<String> alignments,
        @Nullable CreatureCatalogSortField sortField,
        @Nullable CreatureSortDirection sortDirection,
        int pageSize,
        int pageOffset
) {

    public RefreshCreatureCatalogCommand {
        sizes = copyStrings(sizes);
        creatureTypes = copyStrings(creatureTypes);
        creatureSubtypes = copyStrings(creatureSubtypes);
        biomes = copyStrings(biomes);
        alignments = copyStrings(alignments);
    }

    public static RefreshCreatureCatalogCommand defaults() {
        return new RefreshCreatureCatalogCommand(
                null,
                null,
                null,
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                null,
                null,
                50,
                0);
    }

    public static RefreshCreatureCatalogCommand fromSortKey(
            @Nullable String nameQuery,
            @Nullable String challengeRatingMin,
            @Nullable String challengeRatingMax,
            List<String> sizes,
            List<String> creatureTypes,
            List<String> creatureSubtypes,
            List<String> biomes,
            List<String> alignments,
            @Nullable String sortKey,
            int pageSize,
            int pageOffset
    ) {
        SortRequest sort = SortRequest.fromKey(sortKey);
        return new RefreshCreatureCatalogCommand(
                nameQuery,
                challengeRatingMin,
                challengeRatingMax,
                sizes,
                creatureTypes,
                creatureSubtypes,
                biomes,
                alignments,
                sort.field(),
                sort.direction(),
                pageSize,
                pageOffset);
    }

    private static List<String> copyStrings(@Nullable List<String> values) {
        return values == null ? List.of() : List.copyOf(values);
    }

    private record SortRequest(CreatureCatalogSortField field, CreatureSortDirection direction) {

        static SortRequest fromKey(@Nullable String sortKey) {
            return switch (sortKey == null ? "" : sortKey) {
                case "name-desc" -> new SortRequest(CreatureCatalogSortField.NAME, CreatureSortDirection.DESCENDING);
                case "cr-asc" -> new SortRequest(CreatureCatalogSortField.CHALLENGE_RATING, CreatureSortDirection.ASCENDING);
                case "cr-desc" -> new SortRequest(CreatureCatalogSortField.CHALLENGE_RATING, CreatureSortDirection.DESCENDING);
                case "xp-asc" -> new SortRequest(CreatureCatalogSortField.XP, CreatureSortDirection.ASCENDING);
                case "xp-desc" -> new SortRequest(CreatureCatalogSortField.XP, CreatureSortDirection.DESCENDING);
                default -> new SortRequest(CreatureCatalogSortField.NAME, CreatureSortDirection.ASCENDING);
            };
        }
    }
}
