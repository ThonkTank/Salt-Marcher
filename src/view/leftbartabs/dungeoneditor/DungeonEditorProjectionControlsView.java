package src.view.leftbartabs.dungeoneditor;

import javafx.beans.value.ChangeListener;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.Toggle;
import javafx.scene.control.ToggleButton;
import javafx.scene.control.ToggleGroup;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Region;
import src.view.slotcontent.controls.dungeoncontrol.DungeonControlPanelContentModel;
import src.view.slotcontent.controls.dungeoncontrol.DungeonControlPanelView;

final class DungeonEditorProjectionControlsView {

    private static final String VIEW_GRID = "Grid";
    private static final String VIEW_GRAPH = "Graph";

    private final Label levelLabel = new Label("Ebene z=0");
    private final Button previousLevelButton = new Button("-");
    private final Button nextLevelButton = new Button("+");
    private final DungeonControlPanelView.OverlayControlsPanel overlayControls;
    private final ToggleButton gridButton = createToolToggle(VIEW_GRID);
    private final ToggleButton graphButton = createToolToggle(VIEW_GRAPH);
    private final ToggleGroup viewModeGroup = new ToggleGroup();
    private final ChangeListener<Toggle> viewModeListener = (ignored, oldToggle, newToggle) ->
            handleViewModeChanged(oldToggle, newToggle);
    private final HBox row;
    private final DungeonEditorControlsEvents events;
    private final DungeonEditorControlsView panelView;

    DungeonEditorProjectionControlsView(DungeonEditorControlsView panelView, DungeonEditorControlsEvents events) {
        this.panelView = panelView;
        this.events = events;
        this.overlayControls = panelView.newOverlayControls();
        DungeonEditorControlsFxAccess.addStyle(previousLevelButton, "toolbar-action-button");
        DungeonEditorControlsFxAccess.addStyle(nextLevelButton, "toolbar-action-button");
        previousLevelButton.setOnAction(event -> events.projectionShift(-1));
        nextLevelButton.setOnAction(event -> events.projectionShift(1));
        DungeonEditorControlsFxAccess.addStyle(levelLabel, "text-muted");
        panelView.describeNode(previousLevelButton, "Vorherige Dungeon-Ebene anzeigen");
        panelView.describeNode(nextLevelButton, "Nächste Dungeon-Ebene anzeigen");

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

    HBox row() {
        return row;
    }

    void bind(DungeonEditorProjectionControlsContentModel contentModel) {
        contentModel.projectionProperty().addListener((ignored, before, after) -> showProjection(after));
        showProjection(contentModel.projectionProperty().get());
    }

    private void showProjection(DungeonEditorProjectionControlsContentModel.ProjectionState projection) {
        DungeonEditorProjectionControlsContentModel.ProjectionState safeProjection = projection == null
                ? DungeonEditorProjectionControlsContentModel.ProjectionState.initial()
                : projection;
        levelLabel.setText("Ebene z=" + safeProjection.activeLevel());
        previousLevelButton.setDisable(safeProjection.busy() || !safeProjection.navigationEnabled());
        nextLevelButton.setDisable(safeProjection.busy() || !safeProjection.navigationEnabled());
        panelView.contentModel().showOverlaySettings(safeProjection.overlaySettings(), safeProjection.overlayDisabled());
        showViewMode(safeProjection.viewMode());
    }

    private void showViewMode(String viewMode) {
        DungeonEditorControlsListeners.withDetachedToggleUpdate(viewModeGroup, viewModeListener, () -> {
            graphButton.setSelected(VIEW_GRAPH.equals(viewMode));
            gridButton.setSelected(!VIEW_GRAPH.equals(viewMode));
        });
    }

    private void handleViewModeChanged(Toggle oldToggle, Toggle newToggle) {
        if (newToggle == null) {
            if (oldToggle != null) {
                oldToggle.setSelected(true);
            }
            return;
        }
        events.viewModeSelected(graphButton.equals(newToggle) ? VIEW_GRAPH : VIEW_GRID);
    }

    private static ToggleButton createToolToggle(String text) {
        ToggleButton button = new ToggleButton(text);
        DungeonEditorControlsFxAccess.addStyle(button, DungeonEditorControlsView.TOOL_BUTTON_STYLE);
        button.setMinWidth(Region.USE_PREF_SIZE);
        return button;
    }

}
