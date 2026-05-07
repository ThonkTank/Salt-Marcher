package src.domain.creatures.published;

import java.util.List;

public final class EncounterCandidateQuery {

    private final List<String> types;
    private final List<String> subtypes;
    private final List<String> biomes;
    private final int minimumXp;
    private final int maximumXp;
    private final int limit;

    public EncounterCandidateQuery(
            List<String> types,
            List<String> subtypes,
            List<String> biomes,
            int minimumXp,
            int maximumXp,
            int limit
    ) {
        this.types = types == null ? List.of() : List.copyOf(types);
        this.subtypes = subtypes == null ? List.of() : List.copyOf(subtypes);
        this.biomes = biomes == null ? List.of() : List.copyOf(biomes);
        this.minimumXp = minimumXp;
        this.maximumXp = maximumXp;
        this.limit = limit;
    }

    public List<String> types() {
        return types;
    }

    public List<String> subtypes() {
        return subtypes;
    }

    public List<String> biomes() {
        return biomes;
    }

    public int minimumXp() {
        return minimumXp;
    }

    public int maximumXp() {
        return maximumXp;
    }

    public int limit() {
        return limit;
    }
}
