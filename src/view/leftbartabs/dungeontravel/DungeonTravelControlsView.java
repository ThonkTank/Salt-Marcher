package src.view.leftbartabs.dungeontravel;

import javafx.geometry.Pos;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import src.view.slotcontent.controls.dungeoncontrol.DungeonControlPanelView;
import src.view.slotcontent.controls.dungeoncontrol.DungeonLevelOverlayControlsView;

public final class DungeonTravelControlsView extends DungeonControlPanelView {

    private final Label zoomLabel = new Label("Zoom: 100%");
    private final Label mapLabel = new Label("Dungeon");
    private final Label levelLabel = new Label("Ebene z=0");
    private final Button refreshButton = new Button("Refresh");
    private final Button resetViewButton = new Button("Reset view");
    private final Button previousLevelButton = new Button("-");
    private final Button nextLevelButton = new Button("+");
    private final DungeonLevelOverlayControlsView overlayControls =
            new DungeonLevelOverlayControlsView(this::sectionLabel);

    @SuppressWarnings("PMD.ConstructorCallsOverridableMethod")
    public DungeonTravelControlsView() {
        super("");
        getStyleClass().add("control-toolbar");
        configureControls();
        getChildren().setAll(dungeonRow(), projectionRow());
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
        HBox row = compactControlRow(
                zoomLabel,
                levelStepper(),
                overlayControls.trigger());
        row.getStyleClass().add("dungeon-control-projection-row");
        row.setAlignment(Pos.CENTER_LEFT);
        return row;
    }

    private void configureControls() {
        mapLabel.getStyleClass().add("text-muted");
        mapLabel.setMinWidth(0.0);
        mapLabel.setMaxWidth(Double.MAX_VALUE);
        HBox.setHgrow(mapLabel, Priority.ALWAYS);
        zoomLabel.getStyleClass().add("text-muted");
        levelLabel.getStyleClass().add("text-muted");
        refreshButton.getStyleClass().add("toolbar-action-button");
        resetViewButton.getStyleClass().add("toolbar-action-button");
        previousLevelButton.getStyleClass().add("toolbar-action-button");
        nextLevelButton.getStyleClass().add("toolbar-action-button");
        describe(refreshButton, "Dungeon-Karte neu laden");
        describe(resetViewButton, "Kamera auf die Dungeon-Karte zuruecksetzen");
        describe(previousLevelButton, "Vorherige Dungeon-Ebene anzeigen");
        describe(nextLevelButton, "Naechste Dungeon-Ebene anzeigen");
    }

    private HBox dungeonRow() {
        HBox row = compactControlRow(mapLabel, refreshButton, resetViewButton);
        row.getStyleClass().add("dungeon-control-map-row");
        row.setAlignment(Pos.CENTER_LEFT);
        return row;
    }

    private HBox projectionRow() {
        return levelRow();
    }

    private HBox levelStepper() {
        HBox stepper = compactControlGroup(levelLabel, previousLevelButton, nextLevelButton);
        stepper.getStyleClass().add("dungeon-stepper-group");
        return stepper;
    }
}
