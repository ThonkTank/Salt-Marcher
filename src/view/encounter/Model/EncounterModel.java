package src.view.encounter.Model;

import javafx.beans.property.ObjectProperty;
import javafx.beans.property.SimpleObjectProperty;
import javafx.beans.property.SimpleStringProperty;
import javafx.beans.property.StringProperty;
import javafx.collections.FXCollections;
import javafx.collections.ObservableList;
import src.view.creatures.Model.CreatureFilterOptionsViewData;
import src.view.creatures.Model.CreaturesFilterSelectionModel;

import java.util.List;

public final class EncounterModel {

    private final ObservableList<String> difficultyOptions =
            FXCollections.observableArrayList("EASY", "MEDIUM", "HARD", "DEADLY");
    private final ObjectProperty<String> selectedDifficulty = new SimpleObjectProperty<>("MEDIUM");
    private final CreaturesFilterSelectionModel filterSelection = new CreaturesFilterSelectionModel();
    private CreatureFilterOptionsViewData filterOptions = CreatureFilterOptionsViewData.empty();
    private final ObservableList<EncounterAlternativeViewData> alternatives = FXCollections.observableArrayList();
    private final ObjectProperty<EncounterAlternativeViewData> selectedAlternative = new SimpleObjectProperty<>();
    private final StringProperty partySummary = new SimpleStringProperty("No active party.");
    private final StringProperty thresholdsSummary = new SimpleStringProperty("");
    private final StringProperty dailyBudgetSummary = new SimpleStringProperty("");
    private final StringProperty lockSummary = new SimpleStringProperty("Locked: none");
    private final StringProperty excludeSummary = new SimpleStringProperty("Excluded: none");
    private final StringProperty statusText = new SimpleStringProperty("");
    private final StringProperty resultSummary = new SimpleStringProperty("No encounters generated yet.");
    private final StringProperty detailText = new SimpleStringProperty("Generate an encounter to inspect the composition.");

    public ObservableList<String> difficultyOptions() {
        return difficultyOptions;
    }

    public ObjectProperty<String> selectedDifficultyProperty() {
        return selectedDifficulty;
    }

    public CreaturesFilterSelectionModel filterSelection() {
        return filterSelection;
    }

    public CreatureFilterOptionsViewData filterOptions() {
        return filterOptions;
    }

    public ObservableList<EncounterAlternativeViewData> alternatives() {
        return alternatives;
    }

    public ObjectProperty<EncounterAlternativeViewData> selectedAlternativeProperty() {
        return selectedAlternative;
    }

    public StringProperty partySummaryProperty() {
        return partySummary;
    }

    public StringProperty thresholdsSummaryProperty() {
        return thresholdsSummary;
    }

    public StringProperty dailyBudgetSummaryProperty() {
        return dailyBudgetSummary;
    }

    public StringProperty lockSummaryProperty() {
        return lockSummary;
    }

    public StringProperty excludeSummaryProperty() {
        return excludeSummary;
    }

    public StringProperty statusTextProperty() {
        return statusText;
    }

    public StringProperty resultSummaryProperty() {
        return resultSummary;
    }

    public StringProperty detailTextProperty() {
        return detailText;
    }

    public void applyFilterOptions(List<String> types, List<String> subtypes, List<String> biomes) {
        filterOptions = new CreatureFilterOptionsViewData(List.of(), types, subtypes, biomes, List.of(), List.of());
        retainOnly(filterSelection.selectedTypes(), filterOptions.types());
        retainOnly(filterSelection.selectedSubtypes(), filterOptions.subtypes());
        retainOnly(filterSelection.selectedBiomes(), filterOptions.biomes());
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
