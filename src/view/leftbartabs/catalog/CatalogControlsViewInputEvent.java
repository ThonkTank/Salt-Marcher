package src.view.leftbartabs.catalog;

import java.util.List;

public record CatalogControlsViewInputEvent(
        String nameQuery,
        String challengeRatingMin,
        String challengeRatingMax,
        List<String> sizes,
        List<String> types,
        List<String> subtypes,
        List<String> biomes,
        List<String> alignments,
        boolean sizePopupOpen,
        String sizePopupQuery,
        boolean typePopupOpen,
        String typePopupQuery,
        boolean subtypePopupOpen,
        String subtypePopupQuery,
        boolean biomePopupOpen,
        String biomePopupQuery,
        boolean alignmentPopupOpen,
        String alignmentPopupQuery,
        boolean encounterTablePopupOpen,
        String difficultyKey,
        int balanceLevel,
        double amountValue,
        int diversityLevel,
        List<Long> encounterTableIds
) {

    public CatalogControlsViewInputEvent {
        nameQuery = normalized(nameQuery);
        challengeRatingMin = normalized(challengeRatingMin);
        challengeRatingMax = normalized(challengeRatingMax);
        sizes = copyStrings(sizes);
        types = copyStrings(types);
        subtypes = copyStrings(subtypes);
        biomes = copyStrings(biomes);
        alignments = copyStrings(alignments);
        sizePopupQuery = normalized(sizePopupQuery);
        typePopupQuery = normalized(typePopupQuery);
        subtypePopupQuery = normalized(subtypePopupQuery);
        biomePopupQuery = normalized(biomePopupQuery);
        alignmentPopupQuery = normalized(alignmentPopupQuery);
        difficultyKey = normalized(difficultyKey);
        encounterTableIds = copyLongs(encounterTableIds);
    }

    private static String normalized(String value) {
        return value == null ? "" : value;
    }

    private static List<String> copyStrings(List<String> values) {
        return values == null ? List.of() : List.copyOf(values);
    }

    private static List<Long> copyLongs(List<Long> values) {
        return values == null ? List.of() : List.copyOf(values);
    }
}
