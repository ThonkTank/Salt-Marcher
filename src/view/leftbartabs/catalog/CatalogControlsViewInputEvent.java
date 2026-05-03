package src.view.leftbartabs.catalog;

import java.util.List;

public record CatalogControlsViewInputEvent(
        Source source,
        FilterPayload filterState,
        String difficultyKey,
        EncounterTuning tuning,
        List<Long> encounterTableIds
) {

    public CatalogControlsViewInputEvent {
        source = source == null ? Source.FILTERS_CHANGED : source;
        filterState = filterState == null ? FilterPayload.empty() : filterState;
        difficultyKey = difficultyKey == null ? "" : difficultyKey;
        tuning = tuning == null ? EncounterTuning.empty() : tuning;
        encounterTableIds = encounterTableIds == null ? List.of() : List.copyOf(encounterTableIds);
    }

    enum Source {
        FILTERS_CHANGED,
        ENCOUNTER_DIFFICULTY_CHANGED,
        ENCOUNTER_TUNING_CHANGED,
        ENCOUNTER_TABLES_CHANGED
    }

    public record FilterPayload(
            String nameQuery,
            String challengeRatingMin,
            String challengeRatingMax,
            List<String> sizes,
            List<String> types,
            List<String> subtypes,
            List<String> biomes,
            List<String> alignments
    ) {

        public FilterPayload {
            nameQuery = nameQuery == null ? "" : nameQuery;
            challengeRatingMin = challengeRatingMin == null ? "" : challengeRatingMin;
            challengeRatingMax = challengeRatingMax == null ? "" : challengeRatingMax;
            sizes = sizes == null ? List.of() : List.copyOf(sizes);
            types = types == null ? List.of() : List.copyOf(types);
            subtypes = subtypes == null ? List.of() : List.copyOf(subtypes);
            biomes = biomes == null ? List.of() : List.copyOf(biomes);
            alignments = alignments == null ? List.of() : List.copyOf(alignments);
        }

        static FilterPayload empty() {
            return new FilterPayload("", "", "", List.of(), List.of(), List.of(), List.of(), List.of());
        }
    }

    public record EncounterTuning(
            int balanceLevel,
            double amountValue,
            int diversityLevel
    ) {

        static EncounterTuning empty() {
            return new EncounterTuning(-1, -1.0, -1);
        }
    }
}
