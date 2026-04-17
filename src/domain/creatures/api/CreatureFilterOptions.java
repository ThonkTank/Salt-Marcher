package src.domain.creatures.api;

import java.util.List;

public record CreatureFilterOptions(
        List<String> sizes,
        List<String> types,
        List<String> subtypes,
        List<String> biomes,
        List<String> alignments,
        List<String> challengeRatings
) {
    public CreatureFilterOptions {
        sizes = copyOf(sizes);
        types = copyOf(types);
        subtypes = copyOf(subtypes);
        biomes = copyOf(biomes);
        alignments = copyOf(alignments);
        challengeRatings = copyOf(challengeRatings);
    }

    public static CreatureFilterOptions empty() {
        return new CreatureFilterOptions(List.of(), List.of(), List.of(), List.of(), List.of(), List.of());
    }

    private static List<String> copyOf(List<String> values) {
        return values == null ? List.of() : List.copyOf(values);
    }
}
