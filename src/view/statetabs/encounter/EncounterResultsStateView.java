package src.view.statetabs.encounter;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;
import javafx.beans.property.ReadOnlyObjectProperty;
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
    private final Slider resultThresholdSlider = new PercentSlider();
    private final Slider resultFractionSlider = new PercentSlider();
    private final Label resultThresholdValueLabel = styledLabel("", "encounter-results-slider-value");
    private final Label resultFractionValueLabel = styledLabel("", "encounter-results-slider-value");
    private VBox controlsBox;
    private final VBox resultEnemyList = new VBox(4);
    private final Button resultAwardButton = new Button("XP verteilen");
    private final VBox dialog = buildPane();
    private Consumer<EncounterStateViewModel.ResultSelectionDraft> selectionChangedHandler = ignored -> { };
    private Consumer<EncounterStateViewModel.ResultSelectionDraft> awardExperienceHandler = ignored -> { };
    private Consumer<EncounterStateViewModel.ResultSelectionDraft> returnToBuilderHandler = ignored -> { };

    public EncounterResultsStateView() {
        resultEnemyList.getStyleClass().add("encounter-results-enemy-list");
        getChildren().add(dialog);
        setVgrow(dialog, Priority.ALWAYS);
    }

    public void onSelectionChanged(Consumer<EncounterStateViewModel.ResultSelectionDraft> handler) {
        selectionChangedHandler = handler == null ? ignored -> { } : handler;
    }

    public void onAwardExperience(Consumer<EncounterStateViewModel.ResultSelectionDraft> handler) {
        awardExperienceHandler = handler == null ? ignored -> { } : handler;
    }

    public void onReturnToBuilder(Consumer<EncounterStateViewModel.ResultSelectionDraft> handler) {
        returnToBuilderHandler = handler == null ? ignored -> { } : handler;
    }

    public void bind(ReadOnlyObjectProperty<EncounterStateViewModel.ResultsPanel> panelProperty) {
        if (panelProperty == null) {
            return;
        }
        showPanel(panelProperty.get());
        panelProperty.addListener((ignored, before, after) -> showPanel(after));
    }

    private VBox buildPane() {
        Label title = styledLabel("Kampfergebnis", "title");
        resultLootLabel.setWrapText(true);

        VBox summary = new VBox(2, resultXpLabel, resultPartyLabel, resultGoldLabel, resultLootLabel);

        resultThresholdSlider.valueChangingProperty().addListener((obs, oldValue, changing) -> {
            if (!changing) {
                publishSelection();
            }
        });
        resultFractionSlider.valueChangingProperty().addListener((obs, oldValue, changing) -> {
            if (!changing) {
                publishSelection();
            }
        });
        controlsBox = new VBox(4,
                new SliderRow("Besiegungsschwelle", resultThresholdSlider, resultThresholdValueLabel),
                new SliderRow("XP-Anteil", resultFractionSlider, resultFractionValueLabel));

        resultAwardStatusLabel.setWrapText(true);
        resultAwardButton.setMaxWidth(Double.MAX_VALUE);
        resultAwardButton.setOnAction(event -> awardExperienceHandler.accept(draft()));
        Button doneButton = new Button("Zum Planer");
        doneButton.setTooltip(new Tooltip("Zur Encounter-Planung zurückkehren"));
        doneButton.setAccessibleText("Zur Encounter-Planung zurückkehren");
        doneButton.setMaxWidth(Double.MAX_VALUE);
        doneButton.setOnAction(event -> returnToBuilderHandler.accept(draft()));
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

    private void showPanel(EncounterStateViewModel.ResultsPanel panel) {
        EncounterStateViewModel.ResultsPanel safePanel =
                panel == null ? EncounterStateViewModel.ResultsPanel.empty() : panel;
        showEnemies(safePanel.enemies());
        resultThresholdSlider.setValue(safePanel.thresholdFraction());
        resultFractionSlider.setValue(safePanel.xpFraction());
        controlsBox.setVisible(!safePanel.enemies().isEmpty());
        controlsBox.setManaged(controlsBox.isVisible());
        resultSubtitleLabel.setText(safePanel.subtitle());
        resultThresholdValueLabel.setText(safePanel.thresholdValue());
        resultFractionValueLabel.setText(safePanel.fractionValue());
        resultXpLabel.setText(safePanel.xp());
        resultPartyLabel.setText(safePanel.party());
        resultGoldLabel.setText(safePanel.gold());
        resultLootLabel.setText(safePanel.loot());
        resultAwardStatusLabel.setText(safePanel.awardStatus());
        resultAwardButton.setDisable(safePanel.awardButtonDisabled());
    }

    private Separator separator() {
        return new Separator();
    }

    private static Label styledLabel(String text, String... styleClasses) {
        return new StyledLabel(text, styleClasses);
    }

    private void publishSelection() {
        selectionChangedHandler.accept(draft());
    }

    private EncounterStateViewModel.ResultSelectionDraft draft() {
        List<Boolean> selectedEnemies = new ArrayList<>();
        for (Node node : resultEnemyList.getChildren()) {
            boolean selected = node instanceof CheckBox checkBox && checkBox.isSelected();
            selectedEnemies.add(selected);
        }
        return new EncounterStateViewModel.ResultSelectionDraft(
                selectedEnemies,
                resultThresholdSlider.getValue(),
                resultFractionSlider.getValue());
    }

    private void showEnemies(List<EncounterStateViewModel.EnemyView> enemies) {
        resultEnemyList.getChildren().clear();
        for (EncounterStateViewModel.EnemyView enemy : enemies == null ? List.<EncounterStateViewModel.EnemyView>of() : enemies) {
            EnemyToggle toggle = new EnemyToggle(enemy);
            toggle.setSelected(enemy.selected());
            toggle.selectedProperty().addListener((obs, oldValue, newValue) -> publishSelection());
            resultEnemyList.getChildren().add(toggle);
        }
    }

    private static final class StyledVBox extends VBox {

        private StyledVBox(String styleClass, double spacing, Node... children) {
            super(spacing, children);
            getStyleClass().add(styleClass);
        }
    }

    private static final class StyledLabel extends Label {

        private StyledLabel(String text, String... styleClasses) {
            super(text);
            getStyleClass().addAll(styleClasses);
        }
    }

    private static final class EnemyToggle extends CheckBox {

        private EnemyToggle(EncounterStateViewModel.EnemyView enemy) {
            super(enemy.name() + " (" + enemy.status() + ") - " + enemy.loot());
            getStyleClass().add(STYLE_TEXT_SECONDARY);
        }
    }

    private static final class PercentSlider extends Slider {

        private PercentSlider() {
            super(0, 1, 1);
            setMajorTickUnit(0.25);
            setMinorTickCount(4);
            setShowTickMarks(true);
            setShowTickLabels(true);
            setLabelFormatter(new StringConverter<>() {
                @Override
                public String toString(Double value) {
                    return (int) Math.round(value * 100) + "%";
                }

                @Override
                public Double fromString(String string) {
                    return 0.0;
                }
            });
        }
    }

    private static final class SliderRow extends HBox {

        private SliderRow(String title, Slider slider, Label valueLabel) {
            super(8, styledLabel(title, STYLE_TEXT_SECONDARY), slider, valueLabel);
            Label label = (Label) getChildren().get(0);
            label.setLabelFor(slider);
            slider.setAccessibleText(title);
            slider.setAccessibleHelp(title + " in Prozent");
            valueLabel.setAlignment(Pos.CENTER_RIGHT);
            setHgrow(slider, Priority.ALWAYS);
            setAlignment(Pos.CENTER_LEFT);
        }
    }

}
