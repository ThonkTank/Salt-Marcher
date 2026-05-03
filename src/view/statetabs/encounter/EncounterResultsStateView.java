package src.view.statetabs.encounter;

import java.util.List;
import java.util.function.Consumer;
import javafx.geometry.Insets;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.CheckBox;
import javafx.scene.control.Label;
import javafx.scene.control.Separator;
import javafx.scene.control.Slider;
import javafx.scene.control.Tooltip;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.VBox;
import javafx.util.StringConverter;
import src.view.slotcontent.primitives.dialog.DialogSurfaceView;
import src.view.slotcontent.primitives.dialog.DialogSurfaceView.BodyPolicy;

public final class EncounterResultsStateView extends VBox {

    private final Label resultSubtitleLabel = new Label();
    private final Label resultXpLabel = new Label();
    private final Label resultPartyLabel = new Label();
    private final Label resultGoldLabel = new Label();
    private final Label resultLootLabel = new Label();
    private final Label resultAwardStatusLabel = new Label();
    private final Slider resultThresholdSlider = percentSlider();
    private final Slider resultFractionSlider = percentSlider();
    private final Label resultThresholdValueLabel = new Label();
    private final Label resultFractionValueLabel = new Label();
    private final VBox resultEnemyList = new VBox(4);
    private final Button resultAwardButton = new Button("XP verteilen");
    private final DialogSurfaceView dialog = buildPane();
    private EncounterStateView.ResultStateView lastState = EncounterStateView.ResultStateView.empty();
    private Consumer<EncounterResultsStateViewInputEvent> viewInputEventHandler = ignored -> { };

    public EncounterResultsStateView() {
        getChildren().add(dialog);
        VBox.setVgrow(dialog, Priority.ALWAYS);
    }

    public void onViewInputEvent(Consumer<EncounterResultsStateViewInputEvent> handler) {
        viewInputEventHandler = handler == null ? ignored -> { } : handler;
    }

    public void showResults(EncounterStateView.ResultStateView state) {
        EncounterStateView.ResultStateView safeState = state == null
                ? EncounterStateView.ResultStateView.empty()
                : state;
        lastState = safeState;
        resultEnemyList.getChildren().clear();
        for (EncounterStateView.ResultEnemyView enemy : safeState.enemies()) {
            resultEnemyList.getChildren().add(buildResultEnemyRow(enemy));
        }
        resultAwardStatusLabel.setText(safeState.awardStatus());
        resultAwardButton.setDisable(!safeState.canAwardXp() || safeState.xpAwarded());
        updateResultCalculations();
    }

    private DialogSurfaceView buildPane() {
        DialogSurfaceView nextDialog = new DialogSurfaceView();
        Label title = new Label("Kampfergebnis");
        title.getStyleClass().add("title");
        resultSubtitleLabel.getStyleClass().add("text-secondary");
        resultXpLabel.getStyleClass().add("encounter-result-xp");
        resultPartyLabel.getStyleClass().add("text-secondary");
        resultGoldLabel.getStyleClass().add("encounter-result-gold");
        resultLootLabel.getStyleClass().add("text-secondary");
        resultLootLabel.setWrapText(true);

        VBox summary = new VBox(2, resultXpLabel, resultPartyLabel, resultGoldLabel, resultLootLabel);

        resultThresholdSlider.valueProperty().addListener((obs, oldValue, newValue) -> updateResultCalculations());
        resultFractionSlider.valueProperty().addListener((obs, oldValue, newValue) -> updateResultCalculations());
        VBox controls = new VBox(4,
                sliderRow("Besiegungsschwelle", resultThresholdSlider, resultThresholdValueLabel),
                sliderRow("XP-Anteil", resultFractionSlider, resultFractionValueLabel));

        resultEnemyList.setPadding(new Insets(2, 0, 8, 0));

        resultAwardStatusLabel.getStyleClass().add("text-secondary");
        resultAwardStatusLabel.setWrapText(true);
        resultAwardButton.setMaxWidth(Double.MAX_VALUE);
        resultAwardButton.setOnAction(event -> publish(true, false));
        Button doneButton = new Button("Zum Planer");
        doneButton.setTooltip(new Tooltip("Zur Encounter-Planung zurueckkehren"));
        doneButton.setAccessibleText("Zur Encounter-Planung zurueckkehren");
        doneButton.setMaxWidth(Double.MAX_VALUE);
        doneButton.setOnAction(event -> publish(false, true));
        DialogSurfaceView.grow(resultAwardButton);
        DialogSurfaceView.grow(doneButton);

        VBox body = new VBox(8, summary, separator(), controls, separator(), resultEnemyList,
                separator(), resultAwardStatusLabel);
        body.setPadding(DialogSurfaceView.contentInsets());
        nextDialog.setHeader(title, resultSubtitleLabel);
        nextDialog.setBody(body, BodyPolicy.SCROLL);
        nextDialog.setFooter(resultAwardButton, doneButton);
        return nextDialog;
    }

    private Node buildResultEnemyRow(EncounterStateView.ResultEnemyView enemy) {
        CheckBox toggle = new CheckBox(enemy.name() + " (" + enemy.status() + ") - " + enemy.loot());
        toggle.setSelected(enemy.defeatedByDefault());
        toggle.getStyleClass().add("text-secondary");
        toggle.selectedProperty().addListener((obs, oldValue, newValue) -> updateResultCalculations());
        return toggle;
    }

    private void updateResultCalculations() {
        int selectedXp = 0;
        long selectedCount = 0;
        int childIndex = 0;
        for (EncounterStateView.ResultEnemyView enemy : lastState.enemies()) {
            Node node = childIndex < resultEnemyList.getChildren().size() ? resultEnemyList.getChildren().get(childIndex) : null;
            boolean selected = node instanceof CheckBox checkBox && checkBox.isSelected();
            if (selected) {
                selectedXp += enemy.xp();
                selectedCount++;
            }
            childIndex++;
        }
        int thresholdPercent = (int) Math.round(resultThresholdSlider.getValue() * 100);
        int fractionPercent = (int) Math.round(resultFractionSlider.getValue() * 100);
        int awardedXp = (int) Math.round(selectedXp * resultFractionSlider.getValue());
        int partySize = Math.max(1, lastState.partySize());
        int perPlayer = awardedXp / partySize;
        resultSubtitleLabel.setText(selectedCount + " Gegner besiegt | " + selectedXp + " XP");
        resultThresholdValueLabel.setText(thresholdPercent + "%");
        resultFractionValueLabel.setText(fractionPercent + "%");
        resultXpLabel.setText(perPlayer + " XP");
        resultPartyLabel.setText("pro Spieler  (" + partySize + " Spieler | " + awardedXp + " XP gesamt)");
        resultGoldLabel.setText(lastState.goldSummary());
        resultLootLabel.setText(lastState.lootDetail());
    }

    private HBox sliderRow(String title, Slider slider, Label valueLabel) {
        Label label = new Label(title);
        label.getStyleClass().add("text-secondary");
        valueLabel.setMinWidth(40);
        valueLabel.setAlignment(javafx.geometry.Pos.CENTER_RIGHT);
        HBox.setHgrow(slider, Priority.ALWAYS);
        HBox row = new HBox(8, label, slider, valueLabel);
        row.setAlignment(javafx.geometry.Pos.CENTER_LEFT);
        return row;
    }

    private Slider percentSlider() {
        Slider slider = new Slider(0, 1, 1);
        slider.setMajorTickUnit(0.25);
        slider.setMinorTickCount(4);
        slider.setShowTickMarks(true);
        slider.setShowTickLabels(true);
        slider.setLabelFormatter(new StringConverter<>() {
            @Override
            public String toString(Double value) {
                return (int) Math.round(value * 100) + "%";
            }

            @Override
            public Double fromString(String string) {
                return 0.0;
            }
        });
        return slider;
    }

    private Separator separator() {
        return new Separator();
    }

    private void publish(boolean awardRequested, boolean returnToBuilderRequested) {
        viewInputEventHandler.accept(new EncounterResultsStateViewInputEvent(awardRequested, returnToBuilderRequested));
    }
}
