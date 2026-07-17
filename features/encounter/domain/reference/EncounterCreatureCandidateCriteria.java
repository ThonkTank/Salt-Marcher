package features.encounter.domain.reference;

import java.util.List;

public record EncounterCreatureCandidateCriteria(
        List<String> creatureTypes,
        List<String> creatureSubtypes,
        List<String> biomes,
        String nameQuery,
        String challengeRatingMin,
        String challengeRatingMax,
        List<String> sizes,
        List<String> alignments,
        int minimumXp,
        int maximumXp,
        int limit
) {

    public EncounterCreatureCandidateCriteria(
            List<String> creatureTypes,
            List<String> creatureSubtypes,
            List<String> biomes,
            int minimumXp,
            int maximumXp,
            int limit
    ) {
        this(creatureTypes, creatureSubtypes, biomes, "", "", "", List.of(), List.of(),
                minimumXp, maximumXp, limit);
    }

    public EncounterCreatureCandidateCriteria {
        creatureTypes = creatureTypes == null ? List.of() : List.copyOf(creatureTypes);
        creatureSubtypes = creatureSubtypes == null ? List.of() : List.copyOf(creatureSubtypes);
        biomes = biomes == null ? List.of() : List.copyOf(biomes);
        nameQuery = nameQuery == null ? "" : nameQuery.trim();
        challengeRatingMin = challengeRatingMin == null ? "" : challengeRatingMin.trim();
        challengeRatingMax = challengeRatingMax == null ? "" : challengeRatingMax.trim();
        sizes = sizes == null ? List.of() : List.copyOf(sizes);
        alignments = alignments == null ? List.of() : List.copyOf(alignments);
    }
}
