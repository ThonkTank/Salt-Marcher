package src.view.encounter.ViewModel;

import org.jspecify.annotations.Nullable;
import src.domain.creatures.api.CreatureFilterOptions;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@SuppressWarnings("PMD.TooManyMethods")
final class EncounterFilterState {

    private static final List<String> DIFFICULTY_OPTIONS = List.of("EASY", "MEDIUM", "HARD", "DEADLY");

    private final Set<String> selectedTypes = new LinkedHashSet<>();
    private final Set<String> selectedSubtypes = new LinkedHashSet<>();
    private final Set<String> selectedBiomes = new LinkedHashSet<>();

    private String selectedDifficulty = "MEDIUM";
    private List<String> availableTypes = List.of();
    private List<String> availableSubtypes = List.of();
    private List<String> availableBiomes = List.of();

    List<String> difficultyOptions() {
        return DIFFICULTY_OPTIONS;
    }

    String selectedDifficulty() {
        return selectedDifficulty;
    }

    boolean setSelectedDifficulty(@Nullable String difficulty) {
        if (difficulty == null || difficulty.isBlank() || selectedDifficulty.equals(difficulty)) {
            return false;
        }
        selectedDifficulty = difficulty;
        return true;
    }

    boolean setTypeSelected(String value, boolean selected) {
        return updateSelection(selectedTypes, value, selected);
    }

    boolean setSubtypeSelected(String value, boolean selected) {
        return updateSelection(selectedSubtypes, value, selected);
    }

    boolean setBiomeSelected(String value, boolean selected) {
        return updateSelection(selectedBiomes, value, selected);
    }

    void clearFilters() {
        selectedTypes.clear();
        selectedSubtypes.clear();
        selectedBiomes.clear();
    }

    boolean removeFilterValue(String value) {
        boolean changed = selectedTypes.remove(value);
        changed |= selectedSubtypes.remove(value);
        changed |= selectedBiomes.remove(value);
        return changed;
    }

    void applyOptions(CreatureFilterOptions options) {
        availableTypes = options.types();
        availableSubtypes = options.subtypes();
        availableBiomes = options.biomes();
        selectedTypes.retainAll(availableTypes);
        selectedSubtypes.retainAll(availableSubtypes);
        selectedBiomes.retainAll(availableBiomes);
    }

    EncounterSnapshot.FilterOptionsViewData optionsViewData() {
        return new EncounterSnapshot.FilterOptionsViewData(availableTypes, availableSubtypes, availableBiomes);
    }

    EncounterSnapshot.FilterSelectionViewData selectionViewData() {
        return new EncounterSnapshot.FilterSelectionViewData(
                List.copyOf(selectedTypes),
                List.copyOf(selectedSubtypes),
                List.copyOf(selectedBiomes));
    }

    List<String> selectedTypes() {
        return List.copyOf(selectedTypes);
    }

    List<String> selectedSubtypes() {
        return List.copyOf(selectedSubtypes);
    }

    List<String> selectedBiomes() {
        return List.copyOf(selectedBiomes);
    }

    private boolean updateSelection(Set<String> values, @Nullable String value, boolean selected) {
        if (value == null || value.isBlank()) {
            return false;
        }
        return selected ? values.add(value) : values.remove(value);
    }
}
