package src.view.leftbartabs.dungeontravel;

import java.util.function.Consumer;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import src.view.slotcontent.controls.dungeoncontrol.DungeonControlPanelView;

public final class DungeonTravelControlsView extends DungeonControlPanelView {

    private final ToolbarLabel zoomLabel = new ToolbarLabel("Zoom: 100%");
    private final ToolbarLabel mapLabel = new ToolbarLabel("");
    private final ToolbarLabel levelLabel = new ToolbarLabel("Ebene z=0");
    private final ToolbarButton resetViewButton = new ToolbarButton("Ansicht zurücksetzen");
    private final ToolbarButton previousLevelButton = new ToolbarButton("-");
    private final ToolbarButton nextLevelButton = new ToolbarButton("+");
    private final OverlayControlsPanel overlayControls = new OverlayControlsPanel(this::sectionLabel);
    private final InputPublisher inputPublisher = new InputPublisher();
    private Consumer<DungeonTravelControlsViewInputEvent> viewInputEventHandler = ignored -> {};

    public DungeonTravelControlsView() {
        super("");
        getStyleClass().add("control-toolbar");
        configureControls();
        getChildren().setAll(
                new MapRow(mapLabel, resetViewButton),
                new ProjectionRow(zoomLabel, new LevelStepper(levelLabel, previousLevelButton, nextLevelButton), overlayControls.trigger()));
    }

    public void onViewInputEvent(Consumer<DungeonTravelControlsViewInputEvent> handler) {
        viewInputEventHandler = handler == null ? ignored -> {} : handler;
    }

    public void showMapName(String mapName) {
        mapLabel.setText(mapName);
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
                showOverlaySettings(OverlaySettingsAdapter.toOverlaySettings(after), false));
        contributionModel.projectionLevelProperty().addListener((ignored, before, after) ->
                showLevels(after.intValue(), false, true));
        showMapName(contributionModel.mapNameProperty().get());
        showOverlaySettings(OverlaySettingsAdapter.toOverlaySettings(contributionModel.overlaySettingsProperty().get()), false);
        showLevels(contributionModel.projectionLevelProperty().get(), false, true);
    }

    private void configureControls() {
        mapLabel.setMinWidth(0.0);
        mapLabel.setMaxWidth(Double.MAX_VALUE);
        HBox.setHgrow(mapLabel, Priority.ALWAYS);
        resetViewButton.setOnAction(event -> inputPublisher.publish(true, 0, overlayControls.snapshot()));
        previousLevelButton.setOnAction(event -> inputPublisher.publish(false, -1, overlayControls.snapshot()));
        nextLevelButton.setOnAction(event -> inputPublisher.publish(false, 1, overlayControls.snapshot()));
        overlayControls.onChanged(snapshot -> inputPublisher.publish(false, 0, snapshot));
        describe(resetViewButton, "Kamera auf die Dungeon-Karte zurücksetzen");
        describe(previousLevelButton, "Vorherige Dungeon-Ebene anzeigen");
        describe(nextLevelButton, "Nächste Dungeon-Ebene anzeigen");
    }

    private final class InputPublisher {

        private void publish(
                boolean resetViewRequested,
                int projectionLevelShift,
                OverlayControlsPanel.InputSnapshot overlaySnapshot
        ) {
            viewInputEventHandler.accept(new DungeonTravelControlsViewInputEvent(
                    resetViewRequested,
                    projectionLevelShift,
                    overlaySnapshot.modeKey(),
                    overlaySnapshot.range(),
                    overlaySnapshot.opacity(),
                    overlaySnapshot.levelsText()));
        }
    }

    private static final class OverlaySettingsAdapter {

        private static OverlayControlsPanel.Settings toOverlaySettings(
                DungeonTravelContributionModel.OverlayProjection settings
        ) {
            DungeonTravelContributionModel.OverlayProjection resolved = settings == null
                    ? DungeonTravelContributionModel.OverlayProjection.defaults()
                    : settings;
            return new OverlayControlsPanel.Settings(
                    toOverlayMode(resolved),
                    resolved.levelRange(),
                    resolved.opacity(),
                    resolved.selectedLevels());
        }

        private static OverlayControlsPanel.Mode toOverlayMode(
                DungeonTravelContributionModel.OverlayProjection overlayProjection
        ) {
            if (overlayProjection.usesNearbyLevels()) {
                return OverlayControlsPanel.Mode.NEARBY;
            }
            if (overlayProjection.usesSelectedLevels()) {
                return OverlayControlsPanel.Mode.SELECTED;
            }
            return OverlayControlsPanel.Mode.OFF;
        }
    }

    private static final class ToolbarLabel extends Label {

        private ToolbarLabel(String text) {
            super(text);
            getStyleClass().add("text-muted");
        }
    }

    private static final class ToolbarButton extends Button {

        private ToolbarButton(String text) {
            super(text);
            getStyleClass().add("toolbar-action-button");
        }
    }

    private final class MapRow extends HBox {

        private MapRow(Label mapLabel, Button resetViewButton) {
            super(6, mapLabel, resetViewButton);
            getStyleClass().addAll("dungeon-control-row", "dungeon-control-map-row");
            setAlignment(Pos.CENTER_LEFT);
            setMaxWidth(Double.MAX_VALUE);
        }
    }

    private final class ProjectionRow extends HBox {

        private ProjectionRow(Label zoomLabel, HBox levelStepper, Node overlayTrigger) {
            super(6, zoomLabel, levelStepper, overlayTrigger);
            getStyleClass().addAll("dungeon-control-row", "dungeon-control-projection-row");
            setAlignment(Pos.CENTER_LEFT);
            setMaxWidth(Double.MAX_VALUE);
        }
    }

    private final class LevelStepper extends HBox {

        private LevelStepper(Label levelLabel, Button previousLevelButton, Button nextLevelButton) {
            super(0, levelLabel, previousLevelButton, nextLevelButton);
            getStyleClass().addAll("dungeon-control-group", "dungeon-stepper-group");
            setAlignment(Pos.CENTER_LEFT);
            setMaxWidth(USE_PREF_SIZE);
        }
    }
}
