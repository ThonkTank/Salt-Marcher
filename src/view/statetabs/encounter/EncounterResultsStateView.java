package src.view.statetabs.encounter;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;
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

public final class EncounterResultsStateView extends VBox {

    private static final String STYLE_TEXT_SECONDARY = "text-secondary";

    private final Label resultSubtitleLabel = styledLabel("", STYLE_TEXT_SECONDARY);
    private final Label resultXpLabel = styledLabel("", "encounter-result-xp");
    private final Label resultPartyLabel = styledLabel("", STYLE_TEXT_SECONDARY);
    private final Label resultGoldLabel = styledLabel("", "encounter-result-gold");
    private final Label resultLootLabel = styledLabel("", STYLE_TEXT_SECONDARY);
    private final Label resultAwardStatusLabel = styledLabel("", STYLE_TEXT_SECONDARY);
    private final Slider resultThresholdSlider = percentSlider();
    private final Slider resultFractionSlider = percentSlider();
    private final Label resultThresholdValueLabel = styledLabel("", "encounter-results-slider-value");
    private final Label resultFractionValueLabel = styledLabel("", "encounter-results-slider-value");
    private VBox controlsBox;
    private final EnemyList resultEnemyList = new EnemyList();
    private final Button resultAwardButton = new Button("XP verteilen");
    private final VBox dialog = buildPane();
    private Consumer<EncounterResultsStateViewInputEvent> viewInputEventHandler = ignored -> { };

    public EncounterResultsStateView() {
        getChildren().add(dialog);
        setVgrow(dialog, Priority.ALWAYS);
    }

    public void onViewInputEvent(Consumer<EncounterResultsStateViewInputEvent> handler) {
        viewInputEventHandler = handler == null ? ignored -> { } : handler;
    }

    public void bind(EncounterResultsStateContentModel contentModel) {
        if (contentModel == null) {
            return;
        }
        showPanel(contentModel.panelProperty().get());
        contentModel.panelProperty().addListener((ignored, before, after) -> showPanel(after));
    }

    private VBox buildPane() {
        Label title = styledLabel("Kampfergebnis", "title");
        resultLootLabel.setWrapText(true);

        VBox summary = new VBox(2, resultXpLabel, resultPartyLabel, resultGoldLabel, resultLootLabel);

        resultThresholdSlider.valueProperty().addListener((obs, oldValue, newValue) -> publishSelection());
        resultFractionSlider.valueProperty().addListener((obs, oldValue, newValue) -> publishSelection());
        controlsBox = new VBox(4,
                sliderRow("Besiegungsschwelle", resultThresholdSlider, resultThresholdValueLabel),
                sliderRow("XP-Anteil", resultFractionSlider, resultFractionValueLabel));

        resultAwardStatusLabel.setWrapText(true);
        resultAwardButton.setMaxWidth(Double.MAX_VALUE);
        resultAwardButton.setOnAction(event -> publish(true, false));
        Button doneButton = new Button("Zum Planer");
        doneButton.setTooltip(new Tooltip("Zur Encounter-Planung zurückkehren"));
        doneButton.setAccessibleText("Zur Encounter-Planung zurückkehren");
        doneButton.setMaxWidth(Double.MAX_VALUE);
        doneButton.setOnAction(event -> publish(false, true));
        HBox.setHgrow(resultAwardButton, Priority.ALWAYS);
        HBox.setHgrow(doneButton, Priority.ALWAYS);

        VBox body = new StyledVBox("encounter-results-body", 8, summary, separator(), controlsBox, separator(), resultEnemyList,
                separator(), resultAwardStatusLabel);
        VBox header = new VBox(2, title, resultSubtitleLabel);
        HBox footer = new HBox(8, resultAwardButton, doneButton);
        footer.setAlignment(Pos.CENTER_LEFT);
        VBox nextDialog = new StyledVBox("dialog-surface", 10, header, body, footer);
        setVgrow(body, Priority.ALWAYS);
        return nextDialog;
    }

    private void showPanel(EncounterResultsStateContentModel.PanelModel panel) {
        if (panel == null) {
            return;
        }
        showEnemies(panel.enemies());
        resultThresholdSlider.setValue(panel.thresholdFraction());
        resultFractionSlider.setValue(panel.xpFraction());
        controlsBox.setVisible(!panel.enemies().isEmpty());
        controlsBox.setManaged(controlsBox.isVisible());
        resultSubtitleLabel.setText(panel.subtitle());
        resultThresholdValueLabel.setText(panel.thresholdValue());
        resultFractionValueLabel.setText(panel.fractionValue());
        resultXpLabel.setText(panel.xp());
        resultPartyLabel.setText(panel.party());
        resultGoldLabel.setText(panel.gold());
        resultLootLabel.setText(panel.loot());
        resultAwardStatusLabel.setText(panel.awardStatus());
        resultAwardButton.setDisable(panel.awardButtonDisabled());
    }

    private void publishSelection() {
        publish(false, false);
    }

    private HBox sliderRow(String title, Slider slider, Label valueLabel) {
        Label label = styledLabel(title, STYLE_TEXT_SECONDARY);
        label.setLabelFor(slider);
        slider.setAccessibleText(title);
        slider.setAccessibleHelp(title + " in Prozent");
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

    private static Label styledLabel(String text, String... styleClasses) {
        return new StyledLabel(text, styleClasses);
    }

    private void publish(boolean awardExperienceRequested, boolean returnToBuilderRequested) {
        List<Boolean> selectedEnemies = resultEnemyList.selectedEnemies();
        viewInputEventHandler.accept(new EncounterResultsStateViewInputEvent(
                awardExperienceRequested,
                returnToBuilderRequested,
                selectedEnemies,
                resultThresholdSlider.getValue(),
                resultFractionSlider.getValue()));
    }

    private void showEnemies(List<EncounterResultsStateContentModel.EnemyView> enemies) {
        resultEnemyList.showEnemies(enemies, this::publishSelection);
    }

    private static final class StyledVBox extends VBox {

        private StyledVBox(String styleClass, double spacing, Node... children) {
            super(spacing, children);
            getStyleClass().add(styleClass);
        }
    }

    private static final class EnemyList extends VBox {

        private EnemyList() {
            super(4);
            getStyleClass().add("encounter-results-enemy-list");
        }

        private void showEnemies(
                List<EncounterResultsStateContentModel.EnemyView> enemies,
                Runnable selectionHandler
        ) {
            getChildren().clear();
            List<EncounterResultsStateContentModel.EnemyView> safeEnemies = enemies == null ? List.of() : enemies;
            for (EncounterResultsStateContentModel.EnemyView enemy : safeEnemies) {
                getChildren().add(enemyToggle(enemy, selectionHandler));
            }
        }

        private List<Boolean> selectedEnemies() {
            List<Boolean> selectedEnemies = new ArrayList<>();
            for (Node node : getChildren()) {
                selectedEnemies.add(node instanceof CheckBox checkBox && checkBox.isSelected());
            }
            return selectedEnemies;
        }

        private static CheckBox enemyToggle(
                EncounterResultsStateContentModel.EnemyView enemy,
                Runnable selectionHandler
        ) {
            CheckBox toggle = new EnemyToggle(enemy);
            toggle.setSelected(enemy.selected());
            toggle.selectedProperty().addListener((obs, oldValue, newValue) -> selectionHandler.run());
            return toggle;
        }
    }

    private static final class StyledLabel extends Label {

        private StyledLabel(String text, String... styleClasses) {
            super(text);
            getStyleClass().addAll(styleClasses);
        }
    }

    private static final class EnemyToggle extends CheckBox {

        private EnemyToggle(EncounterResultsStateContentModel.EnemyView enemy) {
            super(enemy.name() + " (" + enemy.status() + ") - " + enemy.loot());
            getStyleClass().add(STYLE_TEXT_SECONDARY);
        }
    }
}
