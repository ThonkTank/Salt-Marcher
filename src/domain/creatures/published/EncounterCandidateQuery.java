package src.domain.creatures.published;

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
        types = copyStrings(types);
        subtypes = copyStrings(subtypes);
        biomes = copyStrings(biomes);
    }

    private static List<String> copyStrings(List<String> values) {
        return values == null ? List.of() : List.copyOf(values);
    }
}
