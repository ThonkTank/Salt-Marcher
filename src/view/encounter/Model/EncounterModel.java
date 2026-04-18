package src.view.encounter.Model;

import javafx.beans.property.ObjectProperty;
import javafx.beans.property.SimpleObjectProperty;
import javafx.collections.ObservableList;

import java.util.List;

public final class EncounterModel {

    private final ObservableList<String> difficultyOptions =
            javafx.collections.FXCollections.observableArrayList("EASY", "MEDIUM", "HARD", "DEADLY");
    private final ObjectProperty<String> selectedDifficulty = new SimpleObjectProperty<>("MEDIUM");
    private final EncounterFilterSelectionModel filterSelection = new EncounterFilterSelectionModel();
    private final ObjectProperty<EncounterFilterOptionsViewData> filterOptions =
            new SimpleObjectProperty<>(EncounterFilterOptionsViewData.empty());
    private final EncounterAlternativeState alternativeState = new EncounterAlternativeState();
    private final EncounterTextState textState = new EncounterTextState();

    public ObservableList<String> difficultyOptions() {
        return difficultyOptions;
    }

    public ObjectProperty<String> selectedDifficultyProperty() {
        return selectedDifficulty;
    }

    public EncounterFilterSelectionModel filterSelection() {
        return filterSelection;
    }

    public ObjectProperty<EncounterFilterOptionsViewData> filterOptionsProperty() {
        return filterOptions;
    }

    public EncounterFilterOptionsViewData filterOptions() {
        return filterOptions.get();
    }

    public EncounterAlternativeState alternatives() {
        return alternativeState;
    }

    public EncounterTextState texts() {
        return textState;
    }

    public void applyFilterOptions(List<String> types, List<String> subtypes, List<String> biomes) {
        filterOptions.set(new EncounterFilterOptionsViewData(types, subtypes, biomes));
        EncounterFilterOptionsViewData options = filterOptions.get();
        retainOnly(filterSelection.selectedTypes(), options.types());
        retainOnly(filterSelection.selectedSubtypes(), options.subtypes());
        retainOnly(filterSelection.selectedBiomes(), options.biomes());
    }

    private static void retainOnly(ObservableList<String> target, List<String> allowedValues) {
        target.removeIf(value -> !allowedValues.contains(value));
    }

    public record EncounterAlternativeViewData(
            String title,
            String difficultyLabel,
            int creatureCount,
            int adjustedXp,
            String creatureSummary,
            String highlightSummary,
            List<EncounterCreatureViewData> creatures,
            List<String> highlights
    ) {

        public EncounterAlternativeViewData {
            creatures = creatures == null ? List.of() : List.copyOf(creatures);
            highlights = highlights == null ? List.of() : List.copyOf(highlights);
        }
    }

    public record EncounterCreatureViewData(
            long creatureId,
            String name,
            String challengeRating,
            int xp,
            int quantity,
            String role,
            List<String> tags
    ) {

        public EncounterCreatureViewData {
            quantity = Math.max(1, quantity);
            tags = tags == null ? List.of() : List.copyOf(tags);
        }
    }
}
