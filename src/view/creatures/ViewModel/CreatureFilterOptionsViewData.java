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

    @Override
    public List<String> sizes() {
        return immutableCopy(sizes);
    }

    @Override
    public List<String> types() {
        return immutableCopy(types);
    }

    @Override
    public List<String> subtypes() {
        return immutableCopy(subtypes);
    }

    @Override
    public List<String> biomes() {
        return immutableCopy(biomes);
    }

    @Override
    public List<String> alignments() {
        return immutableCopy(alignments);
    }

    @Override
    public List<String> challengeRatings() {
        return immutableCopy(challengeRatings);
    }

    private static <T> List<T> immutableCopy(List<T> values) {
        return values == null ? List.of() : List.copyOf(values);
    }
}
