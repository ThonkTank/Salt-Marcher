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

    public CatalogControlsViewInputEvent {
        nameQuery = nameQuery == null ? "" : nameQuery;
        challengeRatingMin = challengeRatingMin == null ? "" : challengeRatingMin;
        challengeRatingMax = challengeRatingMax == null ? "" : challengeRatingMax;
        sizes = sizes == null ? List.of() : List.copyOf(sizes);
        types = types == null ? List.of() : List.copyOf(types);
        subtypes = subtypes == null ? List.of() : List.copyOf(subtypes);
        biomes = biomes == null ? List.of() : List.copyOf(biomes);
        alignments = alignments == null ? List.of() : List.copyOf(alignments);
        sizePopupQuery = sizePopupQuery == null ? "" : sizePopupQuery;
        typePopupQuery = typePopupQuery == null ? "" : typePopupQuery;
        subtypePopupQuery = subtypePopupQuery == null ? "" : subtypePopupQuery;
        biomePopupQuery = biomePopupQuery == null ? "" : biomePopupQuery;
        alignmentPopupQuery = alignmentPopupQuery == null ? "" : alignmentPopupQuery;
        encounterTableIds = encounterTableIds == null ? List.of() : List.copyOf(encounterTableIds);
    }
}
