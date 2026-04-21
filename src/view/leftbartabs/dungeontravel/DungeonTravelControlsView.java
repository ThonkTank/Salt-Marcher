package src.view.leftbartabs.dungeontravel;

import javafx.geometry.Pos;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.layout.HBox;
import src.view.slotcontent.controls.dungeoncontrol.DungeonControlPanelView;
import src.view.slotcontent.controls.dungeoncontrol.DungeonLevelOverlayControlsView;

public final class DungeonTravelControlsView extends DungeonControlPanelView {

    private final Label zoomLabel = new Label("Zoom: 100%");
    private final Label mapLabel = new Label("Dungeon");
    private final Label levelLabel = new Label("Ebene z=0");
    private final Button refreshButton = new Button("Refresh");
    private final Button resetViewButton = new Button("Reset view");
    private final Button previousLevelButton = new Button("Ebene -");
    private final Button nextLevelButton = new Button("Ebene +");
    private final DungeonLevelOverlayControlsView overlayControls =
            new DungeonLevelOverlayControlsView(this::sectionLabel);

    @SuppressWarnings("PMD.ConstructorCallsOverridableMethod")
    public DungeonTravelControlsView() {
        super("");
        getStyleClass().add("dungeon-editor-toolbar");
        getChildren().addAll(sectionLabel("Dungeon"), zoomLabel, mapLabel, levelRow(), actionRow());
    }

    public void onRefresh(Runnable action) {
        bindAction(refreshButton, action);
    }

    public void onResetView(Runnable action) {
        bindAction(resetViewButton, action);
    }

    public void onPreviousLevel(Runnable action) {
        bindAction(previousLevelButton, action);
    }

    public void onNextLevel(Runnable action) {
        bindAction(nextLevelButton, action);
    }

    public DungeonLevelOverlayControlsView levelOverlayControls() {
        return overlayControls;
    }

    public void showMapName(String mapName) {
        mapLabel.setText(mapName == null || mapName.isBlank() ? "Dungeon" : mapName);
    }

    public void showZoom(double zoom) {
        zoomLabel.setText("Zoom: " + Math.round(zoom * 100.0) + "%");
    }

    public void showLevel(int level) {
        levelLabel.setText("Ebene z=" + level);
    }

    public void showLevels(int activeLevel, boolean busy, boolean navigationEnabled) {
        showLevel(activeLevel);
        previousLevelButton.setDisable(busy || !navigationEnabled);
        nextLevelButton.setDisable(busy || !navigationEnabled);
    }

    public void showOverlaySettings(DungeonLevelOverlayControlsView.Settings settings, boolean disabled) {
        overlayControls.showSettings(settings, disabled);
    }

    private HBox levelRow() {
        HBox row = new HBox(8, levelLabel, previousLevelButton, nextLevelButton, spacer(), overlayControls.trigger());
        row.setAlignment(Pos.CENTER_LEFT);
        return row;
    }

    private HBox actionRow() {
        HBox row = new HBox(8, refreshButton, resetViewButton);
        row.setAlignment(Pos.CENTER_LEFT);
        return row;
    }
}
