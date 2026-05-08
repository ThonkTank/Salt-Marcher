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

    private static List<String> copyStrings(@Nullable List<String> values) {
        return values == null ? List.of() : List.copyOf(values);
    }
}
