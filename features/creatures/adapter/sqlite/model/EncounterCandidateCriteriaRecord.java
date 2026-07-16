package features.creatures.adapter.sqlite.model;

import java.util.List;

public record EncounterCandidateCriteriaRecord(
        List<String> types,
        List<String> subtypes,
        List<String> biomes,
        int minimumXp,
        int maximumXp,
        int limit
) {
    public EncounterCandidateCriteriaRecord {
        types = copyStrings(types);
        subtypes = copyStrings(subtypes);
        biomes = copyStrings(biomes);
    }

    @Override
    public List<String> types() {
        return copyStrings(types);
    }

    @Override
    public List<String> subtypes() {
        return copyStrings(subtypes);
    }

    @Override
    public List<String> biomes() {
        return copyStrings(biomes);
    }

    private static List<String> copyStrings(List<String> values) {
        return values == null ? List.of() : List.copyOf(values);
    }
}
