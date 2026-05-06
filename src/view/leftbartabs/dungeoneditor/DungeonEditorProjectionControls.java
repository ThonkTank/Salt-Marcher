package src.view.leftbartabs.dungeoneditor;

import javafx.beans.value.ChangeListener;
import javafx.scene.control.Button;
import javafx.scene.control.Toggle;
import javafx.scene.control.ToggleButton;
import javafx.scene.control.ToggleGroup;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Region;
import src.view.slotcontent.controls.dungeoncontrol.DungeonControlPanelView.OverlayControlsPanel;

final class DungeonEditorProjectionControls {

    private final javafx.scene.control.Label levelLabel = new javafx.scene.control.Label("Ebene z=0");
    private final Button previousLevelButton = new Button("-");
    private final Button nextLevelButton = new Button("+");
    private final OverlayControlsPanel overlayControls;
    private final ToggleButton gridButton = createToolToggle(DungeonEditorControlsView.VIEW_GRID);
    private final ToggleButton graphButton = createToolToggle(DungeonEditorControlsView.VIEW_GRAPH);
    private final ToggleGroup viewModeGroup = new ToggleGroup();
    private final ChangeListener<Toggle> viewModeListener = (ignored, oldToggle, newToggle) ->
            handleViewModeChanged(oldToggle, newToggle);
    private final HBox row;
    private final DungeonEditorControlsEvents events;

    DungeonEditorProjectionControls(DungeonEditorControlsView panelView, DungeonEditorControlsEvents events) {
        this.events = events;
        this.overlayControls = new OverlayControlsPanel(panelView::newSectionLabel);
        DungeonEditorControlsFxAccess.addStyle(previousLevelButton, "toolbar-action-button");
        DungeonEditorControlsFxAccess.addStyle(nextLevelButton, "toolbar-action-button");
        previousLevelButton.setOnAction(event -> events.projectionShift(-1));
        nextLevelButton.setOnAction(event -> events.projectionShift(1));
        DungeonEditorControlsFxAccess.addStyle(levelLabel, "text-muted");
        panelView.describeNode(previousLevelButton, "Vorherige Dungeon-Ebene anzeigen");
        panelView.describeNode(nextLevelButton, "Nächste Dungeon-Ebene anzeigen");

        overlayControls.setOnModeChanged(mode -> events.overlayInput(overlayControls));
        overlayControls.setOnRangeChanged(levelRange -> events.overlayInput(overlayControls));
        overlayControls.setOnOpacityChanged(opacity -> events.overlayInput(overlayControls));
        overlayControls.setOnSelectedLevelsChanged(() -> events.overlayInput(overlayControls));

        gridButton.setToggleGroup(viewModeGroup);
        graphButton.setToggleGroup(viewModeGroup);
        gridButton.setSelected(true);
        viewModeGroup.selectedToggleProperty().addListener(viewModeListener);

        HBox stepper = panelView.controlsGroup(levelLabel, previousLevelButton, nextLevelButton);
        DungeonEditorControlsFxAccess.addStyle(stepper, "dungeon-stepper-group");
        HBox viewModeSegment = panelView.controlsGroup(gridButton, graphButton);
        DungeonEditorControlsFxAccess.addStyle(viewModeSegment, "dungeon-segment-group");
        row = panelView.controlsRow(stepper, overlayControls.trigger(), viewModeSegment);
        DungeonEditorControlsFxAccess.addStyle(row, "dungeon-control-projection-row");
    }

    static OverlayControlsPanel.Settings toSettings(DungeonEditorContributionModel.OverlayProjection settings) {
        return new OverlayControlsPanel.Settings(
                OverlayModeKey.fromModelKey(settings.modeKey()).overlayMode(),
                settings.levelRange(),
                settings.opacity(),
                settings.selectedLevels());
    }

    HBox row() {
        return row;
    }

    void showLevels(int activeLevel, boolean busy, boolean navigationEnabled) {
        levelLabel.setText("Ebene z=" + activeLevel);
        previousLevelButton.setDisable(busy || !navigationEnabled);
        nextLevelButton.setDisable(busy || !navigationEnabled);
    }

    void showOverlaySettings(OverlayControlsPanel.Settings settings, boolean disabled) {
        overlayControls.showSettings(settings, disabled);
    }

    void showViewMode(String viewMode) {
        DungeonEditorControlsListeners.withDetachedToggleUpdate(viewModeGroup, viewModeListener, () -> {
            graphButton.setSelected(DungeonEditorControlsView.VIEW_GRAPH.equals(viewMode));
            gridButton.setSelected(!DungeonEditorControlsView.VIEW_GRAPH.equals(viewMode));
        });
    }

    private void handleViewModeChanged(Toggle oldToggle, Toggle newToggle) {
        if (newToggle == null) {
            if (oldToggle != null) {
                oldToggle.setSelected(true);
            }
            return;
        }
        events.viewModeSelected(graphButton.equals(newToggle)
                ? DungeonEditorControlsView.VIEW_GRAPH
                : DungeonEditorControlsView.VIEW_GRID);
    }

    private static ToggleButton createToolToggle(String text) {
        ToggleButton button = new ToggleButton(text);
        DungeonEditorControlsFxAccess.addStyle(button, "tool-btn");
        button.setMinWidth(Region.USE_PREF_SIZE);
        return button;
    }

    private enum OverlayModeKey {
        OFF(OverlayControlsPanel.Mode.OFF),
        NEARBY(OverlayControlsPanel.Mode.NEARBY),
        SELECTED(OverlayControlsPanel.Mode.SELECTED);

        private final OverlayControlsPanel.Mode overlayMode;

        OverlayModeKey(OverlayControlsPanel.Mode overlayMode) {
            this.overlayMode = overlayMode;
        }

        private OverlayControlsPanel.Mode overlayMode() {
            return overlayMode;
        }

        private static OverlayModeKey fromModelKey(String modelKey) {
            for (OverlayModeKey value : values()) {
                if (value.matches(modelKey)) {
                    return value;
                }
            }
            return OFF;
        }

        private boolean matches(String modelKey) {
            return modelKey != null && name().equalsIgnoreCase(modelKey);
        }
    }
}
