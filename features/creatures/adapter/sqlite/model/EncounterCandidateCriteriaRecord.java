package features.creatures.adapter.sqlite.model;

import java.util.List;

public record EncounterCandidateCriteriaRecord(
        String nameQuery,
        List<String> types,
        List<String> subtypes,
        List<String> biomes,
        List<String> sizes,
        List<String> alignments,
        int minimumXp,
        int maximumXp,
        int limit
) {
    public EncounterCandidateCriteriaRecord(
            List<String> types,
            List<String> subtypes,
            List<String> biomes,
            int minimumXp,
            int maximumXp,
            int limit
    ) {
        this("", types, subtypes, biomes, List.of(), List.of(), minimumXp, maximumXp, limit);
    }

    public EncounterCandidateCriteriaRecord {
        nameQuery = nameQuery == null ? "" : nameQuery.trim();
        types = copyStrings(types);
        subtypes = copyStrings(subtypes);
        biomes = copyStrings(biomes);
        sizes = copyStrings(sizes);
        alignments = copyStrings(alignments);
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

    @Override
    public List<String> sizes() {
        return copyStrings(sizes);
    }

    @Override
    public List<String> alignments() {
        return copyStrings(alignments);
    }

    private static List<String> copyStrings(List<String> values) {
        return values == null ? List.of() : List.copyOf(values);
    }
}
