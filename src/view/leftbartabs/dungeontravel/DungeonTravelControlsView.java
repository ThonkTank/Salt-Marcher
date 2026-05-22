package src.view.leftbartabs.dungeontravel;

import java.util.function.Consumer;
import javafx.geometry.Side;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.ComboBox;
import javafx.scene.control.ContextMenu;
import javafx.scene.control.CustomMenuItem;
import javafx.scene.control.Label;
import javafx.scene.control.Slider;
import javafx.scene.control.Spinner;
import javafx.scene.control.TextField;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.VBox;

public final class DungeonTravelControlsView extends VBox {

    private Consumer<DungeonTravelControlsViewInputEvent> viewInputEventHandler = ignored -> {};

    public DungeonTravelControlsView() {
        getStyleClass().addAll("surface-root", "dungeon-control-panel", "control-toolbar");
        setFillWidth(true);
    }

    public void onViewInputEvent(Consumer<DungeonTravelControlsViewInputEvent> handler) {
        viewInputEventHandler = handler == null ? ignored -> {} : handler;
    }

    public void bind(DungeonTravelControlsContentModel contentModel) {
        if (contentModel == null) {
            return;
        }
        Label mapLabel = new ToolbarLabel("");
        Button resetViewButton = new ToolbarButton("Ansicht zurücksetzen");
        Label zoomLabel = new ToolbarLabel("");
        Label levelLabel = new ToolbarLabel("");
        Button previousLevelButton = new ToolbarButton("-");
        Button nextLevelButton = new ToolbarButton("+");
        OverlayButton overlayButton = new OverlayButton();
        OverlayMenu overlayMenu;
        ModeSelector modeSelector = new ModeSelector(contentModel);
        RangeSpinner rangeSpinner = new RangeSpinner();
        OpacitySlider opacitySlider = new OpacitySlider();
        OpacityLabel opacityLabel = new OpacityLabel();
        SelectedLevelsField selectedLevelsField = new SelectedLevelsField();
        PopupRow rangeRow = new PopupRow(new Label("Umfang"), rangeSpinner);
        PopupRow selectedRow = new PopupRow(new Label("Ebenen"), selectedLevelsField);
        boolean[] syncing = {false};
        overlayMenu = new OverlayMenu(modeSelector, opacitySlider, opacityLabel, rangeRow, selectedRow);
        overlayButton.bindDisabled(contentModel);
        modeSelector.bindDisabled(contentModel);
        opacitySlider.bindDisabled(contentModel);
        contentModel.overlayPanelStateProperty().addListener((ignored, before, after) -> {
            syncing[0] = true;
            overlayButton.showPanelState(after);
            modeSelector.selectKey(after.modeKey());
            rangeSpinner.showRange(after.levelRange());
            opacitySlider.showOpacityPercent(after.opacityPercent());
            opacityLabel.showOpacity(opacitySlider.percent());
            selectedLevelsField.showSelectedLevels(after.selectedLevelsText());
            rangeRow.showVisibility(after.rangeVisible());
            rangeSpinner.setDisable(after.rangeDisabled());
            selectedRow.showVisibility(after.selectedVisible());
            selectedLevelsField.setDisable(after.selectedLevelsDisabled());
            syncing[0] = false;
        });
        DungeonTravelControlsContentModel.OverlayPanelState initialPanelState =
                contentModel.overlayPanelStateProperty().get();
        overlayButton.showPanelState(initialPanelState);
        modeSelector.selectKey(initialPanelState.modeKey());
        rangeSpinner.showRange(initialPanelState.levelRange());
        opacitySlider.showOpacityPercent(initialPanelState.opacityPercent());
        opacityLabel.showOpacity(opacitySlider.percent());
        selectedLevelsField.showSelectedLevels(initialPanelState.selectedLevelsText());
        rangeRow.showVisibility(initialPanelState.rangeVisible());
        rangeSpinner.setDisable(initialPanelState.rangeDisabled());
        selectedRow.showVisibility(initialPanelState.selectedVisible());
        selectedLevelsField.setDisable(initialPanelState.selectedLevelsDisabled());

        mapLabel.textProperty().bind(contentModel.mapNameProperty());
        zoomLabel.textProperty().bind(contentModel.zoomLabelProperty());
        levelLabel.textProperty().bind(contentModel.projectionLevelLabelProperty());
        previousLevelButton.disableProperty().bind(contentModel.projectionNavigationDisabledProperty());
        nextLevelButton.disableProperty().bind(contentModel.projectionNavigationDisabledProperty());
        resetViewButton.setOnAction(event -> publish(true, 0, modeSelector.selectedKey(),
                rangeSpinner.value(), opacitySlider.percent(), selectedLevelsField.selectedLevelsText()));
        previousLevelButton.setOnAction(event -> publish(false, -1, modeSelector.selectedKey(),
                rangeSpinner.value(), opacitySlider.percent(), selectedLevelsField.selectedLevelsText()));
        nextLevelButton.setOnAction(event -> publish(false, 1, modeSelector.selectedKey(),
                rangeSpinner.value(), opacitySlider.percent(), selectedLevelsField.selectedLevelsText()));
        overlayButton.setOnAction(event -> overlayMenu.toggle(overlayButton));
        modeSelector.valueProperty().addListener((ignored, before, after) -> {
            if (syncing[0] || after == null) {
                return;
            }
            rangeRow.showVisibility(after.rangeVisible());
            rangeSpinner.setDisable(!after.rangeVisible());
            selectedRow.showVisibility(after.selectedLevelsVisible());
            selectedLevelsField.setDisable(!after.selectedLevelsVisible());
            publish(false, 0, after.key(), rangeSpinner.value(), opacitySlider.percent(),
                    selectedLevelsField.selectedLevelsText());
        });
        rangeSpinner.valueProperty().addListener((ignored, before, after) -> {
            if (!syncing[0] && after != null) {
                publish(false, 0, modeSelector.selectedKey(), after, opacitySlider.percent(),
                        selectedLevelsField.selectedLevelsText());
            }
        });
        opacitySlider.valueProperty().addListener((ignored, before, after) -> {
            opacityLabel.showOpacity(opacitySlider.percent());
            if (!syncing[0] && after != null) {
                publish(false, 0, modeSelector.selectedKey(), rangeSpinner.value(), after.doubleValue(),
                        selectedLevelsField.selectedLevelsText());
            }
        });
        selectedLevelsField.setOnAction(event -> publish(false, 0, modeSelector.selectedKey(), rangeSpinner.value(),
                opacitySlider.percent(), selectedLevelsField.selectedLevelsText()));
        selectedLevelsField.focusedProperty().addListener((ignored, before, focused) -> {
            if (!focused) {
                publish(false, 0, modeSelector.selectedKey(), rangeSpinner.value(),
                        opacitySlider.percent(), selectedLevelsField.selectedLevelsText());
            }
        });
        describe(resetViewButton, "Kamera auf die Dungeon-Karte zurücksetzen");
        describe(previousLevelButton, "Vorherige Dungeon-Ebene anzeigen");
        describe(nextLevelButton, "Nächste Dungeon-Ebene anzeigen");

        getChildren().setAll(
                new ControlRow(mapLabel, resetViewButton),
                new ControlRow(zoomLabel, new ControlGroup(levelLabel, previousLevelButton, nextLevelButton), overlayButton));
    }

    private void publish(
            boolean resetViewRequested,
            int projectionLevelShift,
            String modeKey,
            Integer levelRange,
            double opacityPercent,
            String selectedLevelsText
    ) {
        viewInputEventHandler.accept(new DungeonTravelControlsViewInputEvent(
                resetViewRequested,
                projectionLevelShift,
                modeKey == null ? "" : modeKey,
                levelRange == null ? 0 : levelRange,
                opacityPercent / 100.0,
                selectedLevelsText));
    }

    private static void describe(Node node, String description) {
        node.setAccessibleText(description);
    }

    private static final class RangeSpinner extends Spinner<Integer> {

        private RangeSpinner() {
            super(1, 6, 2);
            getStyleClass().add("dungeon-overlay-range-spinner");
            setEditable(true);
        }

        private void showRange(int value) {
            getValueFactory().setValue(value);
        }

        private int value() {
            Integer currentValue = getValue();
            return currentValue == null ? 0 : currentValue;
        }
    }

    private static final class ModeSelector
            extends ComboBox<DungeonTravelControlsContentModel.OverlayModeOption> {

        private ModeSelector(DungeonTravelControlsContentModel contentModel) {
            getItems().setAll(contentModel.overlayModeOptions());
            setMaxWidth(Double.MAX_VALUE);
            HBox.setHgrow(this, Priority.ALWAYS);
        }

        private void bindDisabled(DungeonTravelControlsContentModel contentModel) {
            disableProperty().bind(contentModel.overlayDisabledProperty());
        }

        private void selectKey(String modeKey) {
            for (DungeonTravelControlsContentModel.OverlayModeOption option : getItems()) {
                if (option.key().equals(modeKey)) {
                    setValue(option);
                    return;
                }
            }
            if (!getItems().isEmpty()) {
                setValue(getItems().get(0));
            }
        }

        private String selectedKey() {
            DungeonTravelControlsContentModel.OverlayModeOption option = getValue();
            return option == null ? "" : option.key();
        }
    }

    private static final class OpacitySlider extends Slider {

        private OpacitySlider() {
            super(10, 90, 35);
            setShowTickMarks(false);
            setShowTickLabels(false);
            HBox.setHgrow(this, Priority.ALWAYS);
        }

        private void bindDisabled(DungeonTravelControlsContentModel contentModel) {
            disableProperty().bind(contentModel.overlayDisabledProperty());
        }

        private void showOpacityPercent(double opacityPercent) {
            setValue(opacityPercent);
        }

        private double percent() {
            return getValue();
        }
    }

    private static final class OpacityLabel extends Label {

        private OpacityLabel() {
            setMinWidth(USE_PREF_SIZE);
        }

        private void showOpacity(double opacityPercent) {
            setText(Math.round(opacityPercent) + "%");
        }
    }

    private static final class SelectedLevelsField extends TextField {

        private SelectedLevelsField() {
            setPromptText("-1, 1, 3");
            setPrefColumnCount(10);
            HBox.setHgrow(this, Priority.ALWAYS);
        }

        private void showSelectedLevels(String selectedLevelsText) {
            setText(selectedLevelsText);
        }

        private String selectedLevelsText() {
            return getText();
        }
    }

    private static final class OverlayMenu extends ContextMenu {

        private OverlayMenu(
                ModeSelector modeSelector,
                OpacitySlider opacitySlider,
                OpacityLabel opacityLabel,
                PopupRow rangeRow,
                PopupRow selectedRow
        ) {
            getItems().setAll(new CustomMenuItem(new PopupContent(
                    new SectionLabel("Overlay"),
                    new PopupRow(new Label("Modus"), modeSelector),
                    new PopupRow(new Label("Staerke"), opacitySlider, opacityLabel),
                    rangeRow,
                    selectedRow), false));
        }

        private void toggle(Button anchor) {
            if (isShowing()) {
                hide();
                return;
            }
            show(anchor, Side.BOTTOM, 0.0, 2.0);
        }
    }

    private static final class ControlRow extends HBox {

        private ControlRow(Node... controls) {
            super(6, controls);
            getStyleClass().add("dungeon-control-row");
            setMaxWidth(Double.MAX_VALUE);
        }
    }

    private static final class ControlGroup extends HBox {

        private ControlGroup(Node... controls) {
            super(0, controls);
            getStyleClass().addAll("dungeon-control-group", "dungeon-stepper-group");
            setMaxWidth(USE_PREF_SIZE);
        }
    }

    private static final class PopupRow extends HBox {

        private PopupRow(Node... controls) {
            super(8, controls);
            setMaxWidth(Double.MAX_VALUE);
        }

        private void showVisibility(boolean visible) {
            setVisible(visible);
            setManaged(visible);
        }
    }

    private static final class PopupContent extends VBox {

        private PopupContent(Node... controls) {
            super(0, controls);
            getStyleClass().addAll("filter-dropdown", "dungeon-overlay-dropdown", "dungeon-overlay-content");
        }
    }

    private static final class ToolbarLabel extends Label {

        private ToolbarLabel(String text) {
            super(text);
            getStyleClass().add("text-muted");
            setMinWidth(0.0);
            setMaxWidth(Double.MAX_VALUE);
            HBox.setHgrow(this, Priority.ALWAYS);
        }
    }

    private static class ToolbarButton extends Button {

        private ToolbarButton(String text) {
            super(text);
            getStyleClass().add("toolbar-action-button");
        }
    }

    private static final class OverlayButton extends ToolbarButton {

        private OverlayButton() {
            super("");
            getStyleClass().add("dungeon-overlay-trigger");
            setMinWidth(USE_PREF_SIZE);
        }

        private void bindDisabled(DungeonTravelControlsContentModel contentModel) {
            disableProperty().bind(contentModel.overlayDisabledProperty());
        }

        private void showPanelState(DungeonTravelControlsContentModel.OverlayPanelState panelState) {
            setText(panelState.triggerText());
        }
    }

    private static final class SectionLabel extends Label {

        private SectionLabel(String text) {
            super(text);
            getStyleClass().addAll("section-header", "text-muted");
        }
    }
}
