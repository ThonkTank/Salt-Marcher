package src.view.leftbartabs.dungeontravel;

import java.util.function.Consumer;
import javafx.geometry.Pos;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import src.view.slotcontent.controls.dungeoncontrol.DungeonControlPanelView;

public final class DungeonTravelControlsView extends DungeonControlPanelView {

    private final Label zoomLabel = new Label("Zoom: 100%");
    private final Label mapLabel = new Label("Dungeon");
    private final Label levelLabel = new Label("Ebene z=0");
    private final Button refreshButton = new Button("Refresh");
    private final Button resetViewButton = new Button("Reset view");
    private final Button previousLevelButton = new Button("-");
    private final Button nextLevelButton = new Button("+");
    private final OverlayControlsPanel overlayControls = new OverlayControlsPanel(this::sectionLabel);
    private Consumer<DungeonTravelControlsViewInputEvent> viewInputEventHandler = ignored -> {};

    @SuppressWarnings("PMD.ConstructorCallsOverridableMethod")
    public DungeonTravelControlsView() {
        super("");
        getStyleClass().add("control-toolbar");
        configureControls();
        getChildren().setAll(dungeonRow(), projectionRow());
    }

    public void onViewInputEvent(Consumer<DungeonTravelControlsViewInputEvent> handler) {
        viewInputEventHandler = handler == null ? ignored -> {} : handler;
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

    public void showOverlaySettings(OverlayControlsPanel.Settings settings, boolean disabled) {
        overlayControls.showSettings(settings, disabled);
    }

    public void bind(DungeonTravelContributionModel contributionModel) {
        if (contributionModel == null) {
            return;
        }
        contributionModel.mapNameProperty().addListener((ignored, before, after) -> showMapName(after));
        contributionModel.overlaySettingsProperty().addListener((ignored, before, after) ->
                showOverlaySettings(toOverlaySettings(after), false));
        contributionModel.projectionLevelProperty().addListener((ignored, before, after) ->
                showLevels(after.intValue(), false, true));
        showMapName(contributionModel.mapNameProperty().get());
        showOverlaySettings(toOverlaySettings(contributionModel.overlaySettingsProperty().get()), false);
        showLevels(contributionModel.projectionLevelProperty().get(), false, true);
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
        refreshButton.setOnAction(event -> publishSnapshot(true, false, 0));
        resetViewButton.setOnAction(event -> publishSnapshot(false, true, 0));
        previousLevelButton.setOnAction(event -> publishSnapshot(false, false, -1));
        nextLevelButton.setOnAction(event -> publishSnapshot(false, false, 1));
        overlayControls.setOnModeChanged(mode -> publishSnapshot(false, false, 0));
        overlayControls.setOnRangeChanged(levelRange -> publishSnapshot(false, false, 0));
        overlayControls.setOnOpacityChanged(opacity -> publishSnapshot(false, false, 0));
        overlayControls.setOnSelectedLevelsChanged(() -> publishSnapshot(false, false, 0));
        describe(refreshButton, "Dungeon-Karte neu laden");
        describe(resetViewButton, "Kamera auf die Dungeon-Karte zuruecksetzen");
        describe(previousLevelButton, "Vorherige Dungeon-Ebene anzeigen");
        describe(nextLevelButton, "Naechste Dungeon-Ebene anzeigen");
    }

    private void publishSnapshot(boolean refreshRequested, boolean resetViewRequested, int projectionLevelShift) {
        viewInputEventHandler.accept(new DungeonTravelControlsViewInputEvent(
                refreshRequested,
                resetViewRequested,
                projectionLevelShift,
                overlayControls.overlayModeKey(),
                overlayControls.overlayRange(),
                overlayControls.overlayOpacity(),
                overlayControls.overlayLevelsText()));
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

    private static OverlayControlsPanel.Settings toOverlaySettings(
            DungeonTravelContributionModel.OverlayProjection settings
    ) {
        DungeonTravelContributionModel.OverlayProjection resolved = settings == null
                ? DungeonTravelContributionModel.OverlayProjection.defaults()
                : settings;
        return new OverlayControlsPanel.Settings(
                toOverlayMode(resolved.modeKey()),
                resolved.levelRange(),
                resolved.opacity(),
                resolved.selectedLevels());
    }

    private static OverlayControlsPanel.Mode toOverlayMode(String overlayModeKey) {
        return switch (overlayModeKey == null ? "OFF" : overlayModeKey) {
            case "OFF" -> OverlayControlsPanel.Mode.OFF;
            case "NEARBY" -> OverlayControlsPanel.Mode.NEARBY;
            case "SELECTED" -> OverlayControlsPanel.Mode.SELECTED;
            default -> OverlayControlsPanel.Mode.OFF;
        };
    }

    private HBox levelStepper() {
        HBox stepper = compactControlGroup(levelLabel, previousLevelButton, nextLevelButton);
        stepper.getStyleClass().add("dungeon-stepper-group");
        return stepper;
    }
}
