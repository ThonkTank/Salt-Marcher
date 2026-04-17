package src.domain.creatures.api;

import java.util.List;

public record EncounterCandidateQuery(
        List<String> types,
        List<String> subtypes,
        List<String> biomes,
        int minimumXp,
        int maximumXp,
        int limit
) {
    public EncounterCandidateQuery {
        types = types == null ? List.of() : List.copyOf(types);
        subtypes = subtypes == null ? List.of() : List.copyOf(subtypes);
        biomes = biomes == null ? List.of() : List.copyOf(biomes);
    }
}
