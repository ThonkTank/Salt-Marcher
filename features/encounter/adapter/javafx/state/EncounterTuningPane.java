package features.encounter.adapter.javafx.state;

import javafx.geometry.Insets;
import javafx.scene.control.CheckBox;
import javafx.scene.control.Label;
import javafx.scene.control.Slider;
import javafx.scene.control.TitledPane;
import javafx.scene.layout.GridPane;
import javafx.scene.layout.Priority;
import features.encounter.api.EncounterApi;
import features.encounter.api.EncounterBuilderInputs;
import features.encounter.api.EncounterBuilderInputsModel;
import features.encounter.api.EncounterTuningSettings;
import features.encounter.api.UpdateEncounterTuningCommand;

/** Encounter-owned, collapsible composition controls. */
final class EncounterTuningPane extends TitledPane {

    private final EncounterApi encounters;
    private final CheckBox difficultyAuto = auto();
    private final CheckBox balanceAuto = auto();
    private final CheckBox amountAuto = auto();
    private final CheckBox diversityAuto = auto();
    private final Slider difficulty = slider(1, 4, 2);
    private final Slider balance = slider(1, 5, 3);
    private final Slider amount = slider(1, 5, 3);
    private final Slider diversity = slider(1, 4, 3);
    private final Label difficultyValue = new Label();
    private final Label balanceValue = new Label();
    private final Label amountValue = new Label();
    private final Label diversityValue = new Label();
    private boolean applying;

    EncounterTuningPane(
            EncounterApi encounters,
            EncounterBuilderInputsModel inputsModel
    ) {
        super("Encounter abstimmen", new GridPane());
        this.encounters = encounters;
        setExpanded(false);
        setAnimated(false);
        getStyleClass().add("encounter-tuning-pane");
        GridPane grid = (GridPane) getContent();
        grid.setHgap(8);
        grid.setVgap(6);
        grid.setPadding(new Insets(8));
        addRow(grid, 0, "Schwierigkeit", difficultyAuto, difficulty, difficultyValue);
        addRow(grid, 1, "Balance", balanceAuto, balance, balanceValue);
        addRow(grid, 2, "Menge", amountAuto, amount, amountValue);
        addRow(grid, 3, "Diversität", diversityAuto, diversity, diversityValue);
        configurePublishing();
        inputsModel.subscribe(this::apply);
        apply(inputsModel.current());
    }

    private void configurePublishing() {
        difficultyAuto.setOnAction(ignored -> publish());
        balanceAuto.setOnAction(ignored -> publish());
        amountAuto.setOnAction(ignored -> publish());
        diversityAuto.setOnAction(ignored -> publish());
        difficulty.valueProperty().addListener((ignored, before, after) -> publish());
        balance.valueProperty().addListener((ignored, before, after) -> publish());
        amount.valueProperty().addListener((ignored, before, after) -> publish());
        diversity.valueProperty().addListener((ignored, before, after) -> publish());
    }

    private void apply(EncounterBuilderInputs inputs) {
        EncounterBuilderInputs safe = inputs == null ? EncounterBuilderInputs.empty() : inputs;
        applying = true;
        try {
            difficultyAuto.setSelected(safe.autoDifficulty());
            balanceAuto.setSelected(safe.autoBalance());
            amountAuto.setSelected(safe.autoAmount());
            diversityAuto.setSelected(safe.autoDiversity());
            difficulty.setValue(safe.difficultyLevel());
            balance.setValue(safe.balanceLevel());
            amount.setValue(safe.amountValue());
            diversity.setValue(safe.diversityLevel());
            updateLabels();
        } finally {
            applying = false;
        }
    }

    private void publish() {
        updateLabels();
        if (applying) {
            return;
        }
        encounters.updateTuning(new UpdateEncounterTuningCommand(new EncounterTuningSettings(
                difficultyAuto.isSelected(), rounded(difficulty),
                balanceAuto.isSelected(), rounded(balance),
                amountAuto.isSelected(), amount.getValue(),
                diversityAuto.isSelected(), rounded(diversity))));
    }

    private void updateLabels() {
        difficultyValue.setText(difficultyAuto.isSelected() ? "Auto" : Integer.toString(rounded(difficulty)));
        balanceValue.setText(balanceAuto.isSelected() ? "Auto" : Integer.toString(rounded(balance)));
        amountValue.setText(amountAuto.isSelected() ? "Auto" : String.format(java.util.Locale.ROOT, "%.1f", amount.getValue()));
        diversityValue.setText(diversityAuto.isSelected() ? "Auto" : Integer.toString(rounded(diversity)));
    }

    private static void addRow(GridPane grid, int row, String label, CheckBox auto, Slider slider, Label value) {
        grid.addRow(row, new Label(label), auto, slider, value);
        GridPane.setHgrow(slider, Priority.ALWAYS);
    }

    private static CheckBox auto() {
        CheckBox box = new CheckBox("Auto");
        box.setSelected(true);
        return box;
    }

    private static Slider slider(double minimum, double maximum, double initial) {
        Slider slider = new Slider(minimum, maximum, initial);
        slider.setBlockIncrement(1);
        slider.setMajorTickUnit(1);
        slider.setMinorTickCount(0);
        slider.setSnapToTicks(true);
        slider.setMaxWidth(Double.MAX_VALUE);
        return slider;
    }

    private static int rounded(Slider slider) {
        return (int) Math.round(slider.getValue());
    }
}
