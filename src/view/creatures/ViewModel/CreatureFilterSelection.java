package src.view.creatures.ViewModel;

import org.jspecify.annotations.Nullable;

import java.util.List;

public record CreatureFilterSelection(
        String searchText,
        @Nullable String selectedChallengeRatingMin,
        @Nullable String selectedChallengeRatingMax,
        List<String> selectedSizes,
        List<String> selectedTypes,
        List<String> selectedSubtypes,
        List<String> selectedBiomes,
        List<String> selectedAlignments
) {

    public CreatureFilterSelection {
        searchText = searchText == null ? "" : searchText;
        selectedSizes = immutableCopy(selectedSizes);
        selectedTypes = immutableCopy(selectedTypes);
        selectedSubtypes = immutableCopy(selectedSubtypes);
        selectedBiomes = immutableCopy(selectedBiomes);
        selectedAlignments = immutableCopy(selectedAlignments);
    }

    public static CreatureFilterSelection empty() {
        return new CreatureFilterSelection("", null, null, List.of(), List.of(), List.of(), List.of(), List.of());
    }

    @Override
    public List<String> selectedSizes() {
        return immutableCopy(selectedSizes);
    }

    @Override
    public List<String> selectedTypes() {
        return immutableCopy(selectedTypes);
    }

    @Override
    public List<String> selectedSubtypes() {
        return immutableCopy(selectedSubtypes);
    }

    @Override
    public List<String> selectedBiomes() {
        return immutableCopy(selectedBiomes);
    }

    @Override
    public List<String> selectedAlignments() {
        return immutableCopy(selectedAlignments);
    }

    private static <T> List<T> immutableCopy(List<T> values) {
        return values == null ? List.of() : List.copyOf(values);
    }
}
