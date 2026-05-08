package src.view.leftbartabs.catalog;

import java.util.List;

public record CatalogPublishedEvent(
        Kind kind,
        String nameQuery,
        String challengeRatingMin,
        String challengeRatingMax,
        List<String> sizes,
        List<String> creatureTypes,
        List<String> creatureSubtypes,
        List<String> biomes,
        List<String> alignments,
        String sortKey,
        int pageOffset,
        boolean difficultyAuto,
        double difficultyValue,
        boolean balanceAuto,
        double balanceValue,
        boolean amountAuto,
        double amountValue,
        boolean diversityAuto,
        double diversityValue,
        List<Long> encounterTableIds,
        long creatureId
) {

    public CatalogPublishedEvent {
        kind = kind == null ? Kind.UPDATE_BUILDER_INPUTS : kind;
        nameQuery = nameQuery == null ? "" : nameQuery;
        challengeRatingMin = challengeRatingMin == null ? "" : challengeRatingMin;
        challengeRatingMax = challengeRatingMax == null ? "" : challengeRatingMax;
        sizes = copyStrings(sizes);
        creatureTypes = copyStrings(creatureTypes);
        creatureSubtypes = copyStrings(creatureSubtypes);
        biomes = copyStrings(biomes);
        alignments = copyStrings(alignments);
        sortKey = sortKey == null ? "" : sortKey;
        pageOffset = Math.max(0, pageOffset);
        encounterTableIds = copyLongs(encounterTableIds);
        creatureId = Math.max(0L, creatureId);
    }

    @SuppressWarnings("PMD.ExcessiveParameterList")
    static CatalogPublishedEvent search(
            String nameQuery,
            String challengeRatingMin,
            String challengeRatingMax,
            List<String> sizes,
            List<String> creatureTypes,
            List<String> creatureSubtypes,
            List<String> biomes,
            List<String> alignments,
            String sortKey,
            int pageOffset
    ) {
        return new CatalogPublishedEvent(
                Kind.SEARCH,
                nameQuery,
                challengeRatingMin,
                challengeRatingMax,
                sizes,
                creatureTypes,
                creatureSubtypes,
                biomes,
                alignments,
                sortKey,
                pageOffset,
                true,
                0.0,
                true,
                0.0,
                true,
                0.0,
                true,
                0.0,
                List.of(),
                0L);
    }

    @SuppressWarnings("PMD.ExcessiveParameterList")
    static CatalogPublishedEvent updateBuilderInputs(
            List<String> creatureTypes,
            List<String> creatureSubtypes,
            List<String> biomes,
            boolean difficultyAuto,
            double difficultyValue,
            boolean balanceAuto,
            double balanceValue,
            boolean amountAuto,
            double amountValue,
            boolean diversityAuto,
            double diversityValue,
            List<Long> encounterTableIds
    ) {
        return new CatalogPublishedEvent(
                Kind.UPDATE_BUILDER_INPUTS,
                "",
                "",
                "",
                List.of(),
                creatureTypes,
                creatureSubtypes,
                biomes,
                List.of(),
                "",
                0,
                difficultyAuto,
                difficultyValue,
                balanceAuto,
                balanceValue,
                amountAuto,
                amountValue,
                diversityAuto,
                diversityValue,
                encounterTableIds,
                0L);
    }

    static CatalogPublishedEvent addCreature(long creatureId) {
        return new CatalogPublishedEvent(
                Kind.ADD_CREATURE,
                "",
                "",
                "",
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                "",
                0,
                true,
                0.0,
                true,
                0.0,
                true,
                0.0,
                true,
                0.0,
                List.of(),
                creatureId);
    }

    enum Kind {
        SEARCH,
        UPDATE_BUILDER_INPUTS,
        ADD_CREATURE
    }

    private static List<String> copyStrings(List<String> values) {
        return values == null ? List.of() : List.copyOf(values);
    }

    private static List<Long> copyLongs(List<Long> values) {
        return values == null ? List.of() : List.copyOf(values);
    }
}
