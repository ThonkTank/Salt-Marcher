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
        @Nullable String sortFieldName,
        @Nullable String sortDirectionName,
        int pageSize,
        int pageOffset
) {
    private static final String DEFAULT_SORT_FIELD = "NAME";
    private static final String DEFAULT_SORT_DIRECTION = "ASCENDING";

    public RefreshCreatureCatalogCommand {
        sizes = copyStrings(sizes);
        creatureTypes = copyStrings(creatureTypes);
        creatureSubtypes = copyStrings(creatureSubtypes);
        biomes = copyStrings(biomes);
        alignments = copyStrings(alignments);
        sortFieldName = sortFieldName == null ? DEFAULT_SORT_FIELD : sortFieldName;
        sortDirectionName = sortDirectionName == null ? DEFAULT_SORT_DIRECTION : sortDirectionName;
    }

    @Override
    public List<String> sizes() {
        return copyStrings(sizes);
    }

    @Override
    public List<String> creatureTypes() {
        return copyStrings(creatureTypes);
    }

    @Override
    public List<String> creatureSubtypes() {
        return copyStrings(creatureSubtypes);
    }

    @Override
    public List<String> biomes() {
        return copyStrings(biomes);
    }

    @Override
    public List<String> alignments() {
        return copyStrings(alignments);
    }

    private static List<String> copyStrings(@Nullable List<String> values) {
        return values == null ? List.of() : List.copyOf(values);
    }
}
