package features.creatures.adapter.sqlite.model;

import java.util.List;

public final class CreatureFilterValuesRecord {

    private final List<String> sizes;
    private final List<String> types;
    private final List<String> subtypes;
    private final List<String> biomes;
    private final List<String> alignments;

    public CreatureFilterValuesRecord(
            List<String> sizes,
            List<String> types,
            List<String> subtypes,
            List<String> biomes,
            List<String> alignments
    ) {
        this.sizes = immutableCopy(sizes);
        this.types = immutableCopy(types);
        this.subtypes = immutableCopy(subtypes);
        this.biomes = immutableCopy(biomes);
        this.alignments = immutableCopy(alignments);
    }

    public List<String> sizes() {
        return List.copyOf(sizes);
    }

    public List<String> types() {
        return List.copyOf(types);
    }

    public List<String> subtypes() {
        return List.copyOf(subtypes);
    }

    public List<String> biomes() {
        return List.copyOf(biomes);
    }

    public List<String> alignments() {
        return List.copyOf(alignments);
    }

    private static List<String> immutableCopy(List<String> values) {
        return values == null ? List.of() : List.copyOf(values);
    }
}
