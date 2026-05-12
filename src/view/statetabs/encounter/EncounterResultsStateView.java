package src.view.statetabs.encounter;

import java.util.List;
import java.util.function.Consumer;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
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
import src.view.slotcontent.primitives.dialog.DialogSurfaceContentModel;
import src.view.slotcontent.primitives.dialog.DialogSurfaceView;

public final class EncounterResultsStateView extends VBox {

    private static final String STYLE_TEXT_SECONDARY = "text-secondary";

    private final StyledLabel resultSubtitleLabel = styledLabel("", STYLE_TEXT_SECONDARY);
    private final StyledLabel resultXpLabel = styledLabel("", "encounter-result-xp");
    private final StyledLabel resultPartyLabel = styledLabel("", STYLE_TEXT_SECONDARY);
    private final StyledLabel resultGoldLabel = styledLabel("", "encounter-result-gold");
    private final StyledLabel resultLootLabel = styledLabel("", STYLE_TEXT_SECONDARY);
    private final StyledLabel resultAwardStatusLabel = styledLabel("", STYLE_TEXT_SECONDARY);
    private final Slider resultThresholdSlider = percentSlider();
    private final Slider resultFractionSlider = percentSlider();
    private final Label resultThresholdValueLabel = new Label();
    private final Label resultFractionValueLabel = new Label();
    private final EnemySelectionList resultEnemyList = new EnemySelectionList();
    private final Button resultAwardButton = new Button("XP verteilen");
    private final DialogSurfaceContentModel dialogContentModel = new DialogSurfaceContentModel();
    private final DialogSurfaceView dialog = buildPane();
    private EncounterResultStateView lastState = EncounterResultStateView.empty();
    private Consumer<EncounterResultsStateViewInputEvent> viewInputEventHandler = ignored -> { };

    public EncounterResultsStateView() {
        getChildren().add(dialog);
        setVgrow(dialog, Priority.ALWAYS);
    }

    public void onViewInputEvent(Consumer<EncounterResultsStateViewInputEvent> handler) {
        viewInputEventHandler = handler == null ? ignored -> { } : handler;
    }

    public void showResults(EncounterResultStateView state) {
        EncounterResultStateView safeState = state == null
                ? EncounterResultStateView.empty()
                : state;
        lastState = safeState;
        resultEnemyList.showEnemies(safeState.enemies(), this::updateResultCalculations);
        resultAwardStatusLabel.setText(safeState.awardStatus());
        resultAwardButton.setDisable(!safeState.canAwardXp() || safeState.xpAwarded());
        updateResultCalculations();
    }

    private DialogSurfaceView buildPane() {
        Label title = styledLabel("Kampfergebnis", "title");
        resultLootLabel.setWrapText(true);

        VBox summary = new VBox(2, resultXpLabel, resultPartyLabel, resultGoldLabel, resultLootLabel);

        resultThresholdSlider.valueProperty().addListener((obs, oldValue, newValue) -> updateResultCalculations());
        resultFractionSlider.valueProperty().addListener((obs, oldValue, newValue) -> updateResultCalculations());
        VBox controls = new VBox(4,
                sliderRow("Besiegungsschwelle", resultThresholdSlider, resultThresholdValueLabel),
                sliderRow("XP-Anteil", resultFractionSlider, resultFractionValueLabel));

        resultAwardStatusLabel.setWrapText(true);
        resultAwardButton.setMaxWidth(Double.MAX_VALUE);
        resultAwardButton.setOnAction(event -> publish(EncounterResultsStateViewInputEvent.Action.AWARD_XP));
        Button doneButton = new Button("Zum Planer");
        doneButton.setTooltip(new Tooltip("Zur Encounter-Planung zurückkehren"));
        doneButton.setAccessibleText("Zur Encounter-Planung zurückkehren");
        doneButton.setMaxWidth(Double.MAX_VALUE);
        doneButton.setOnAction(event -> publish(EncounterResultsStateViewInputEvent.Action.RETURN_TO_BUILDER));
        DialogSurfaceView.grow(resultAwardButton);
        DialogSurfaceView.grow(doneButton);

        VBox body = new VBox(8, summary, separator(), controls, separator(), resultEnemyList,
                separator(), resultAwardStatusLabel);
        body.setPadding(DialogSurfaceView.contentInsets());
        VBox header = new VBox(2, title, resultSubtitleLabel);
        HBox footer = new HBox(8, resultAwardButton, doneButton);
        footer.setAlignment(Pos.CENTER_LEFT);
        DialogSurfaceView nextDialog = new DialogSurfaceView(header, body, footer);
        nextDialog.bind(dialogContentModel);
        dialogContentModel.showLayout(DialogSurfaceContentModel.BodyPolicy.SCROLL, true, true);
        return nextDialog;
    }

    private void updateResultCalculations() {
        int selectedXp = 0;
        long selectedCount = 0;
        int childIndex = 0;
        for (EncounterResultEnemyView enemy : lastState.enemies()) {
            if (resultEnemyList.isSelected(childIndex)) {
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
        Label label = styledLabel(title, STYLE_TEXT_SECONDARY);
        valueLabel.setMinWidth(40);
        valueLabel.setAlignment(Pos.CENTER_RIGHT);
        HBox.setHgrow(slider, Priority.ALWAYS);
        HBox row = new HBox(8, label, slider, valueLabel);
        row.setAlignment(Pos.CENTER_LEFT);
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

    private static StyledLabel styledLabel(String text, String... styleClasses) {
        StyledLabel label = new StyledLabel(text);
        label.addStyles(styleClasses);
        return label;
    }

    private void publish(EncounterResultsStateViewInputEvent.Action action) {
        viewInputEventHandler.accept(new EncounterResultsStateViewInputEvent(action));
    }

    private static final class EnemySelectionList extends VBox {

        private EnemySelectionList() {
            super(4);
            setPadding(new Insets(2, 0, 8, 0));
        }

        private void showEnemies(
                List<EncounterResultEnemyView> enemies,
                Runnable onSelectionChanged
        ) {
            List<EncounterResultEnemyView> safeEnemies = enemies == null ? List.of() : enemies;
            Runnable safeSelectionChanged = onSelectionChanged == null ? () -> { } : onSelectionChanged;
            getChildren().setAll(safeEnemies.stream()
                    .map(enemy -> createToggle(enemy, safeSelectionChanged))
                    .toList());
        }

        private boolean isSelected(int index) {
            if (index < 0 || index >= getChildren().size()) {
                return false;
            }
            Node node = getChildren().get(index);
            return node instanceof CheckBox checkBox && checkBox.isSelected();
        }

        private CheckBox createToggle(
                EncounterResultEnemyView enemy,
                Runnable onSelectionChanged
        ) {
            StyledCheckBox toggle = new StyledCheckBox(enemy.name() + " (" + enemy.status() + ") - " + enemy.loot());
            toggle.addStyles(STYLE_TEXT_SECONDARY);
            toggle.setSelected(enemy.defeatedByDefault());
            toggle.selectedProperty().addListener((obs, oldValue, newValue) -> onSelectionChanged.run());
            return toggle;
        }
    }

    private static final class StyledLabel extends Label {

        private StyledLabel(String text) {
            super(text);
        }

        private void addStyles(String... styleClasses) {
            getStyleClass().addAll(styleClasses);
        }
    }

    private static final class StyledCheckBox extends CheckBox {

        private StyledCheckBox(String text) {
            super(text);
        }

        private void addStyles(String... styleClasses) {
            getStyleClass().addAll(styleClasses);
        }
    }
}
