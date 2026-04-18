package src.view.creatures.ViewModel;

import java.util.List;

/**
 * View-local filter options for the creatures catalog UI.
 */
public record CreatureFilterOptionsViewData(
        List<String> sizes,
        List<String> types,
        List<String> subtypes,
        List<String> biomes,
        List<String> alignments,
        List<String> challengeRatings
) {

    public CreatureFilterOptionsViewData {
        sizes = immutableCopy(sizes);
        types = immutableCopy(types);
        subtypes = immutableCopy(subtypes);
        biomes = immutableCopy(biomes);
        alignments = immutableCopy(alignments);
        challengeRatings = immutableCopy(challengeRatings);
    }

    public static CreatureFilterOptionsViewData empty() {
        return new CreatureFilterOptionsViewData(List.of(), List.of(), List.of(), List.of(), List.of(), List.of());
    }

    private static <T> List<T> immutableCopy(List<T> values) {
        return values == null ? List.of() : List.copyOf(values);
    }
}
