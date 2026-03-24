package features.world.dungeonmap.shell.runtime;

import features.world.api.WorldTravelSurface;
import features.world.dungeonmap.application.runtime.DungeonHeading;
import features.world.dungeonmap.application.runtime.DungeonRuntimeDoorDescriptor;
import features.world.dungeonmap.application.runtime.DungeonRuntimeLabels;
import features.world.dungeonmap.application.runtime.DungeonRuntimeLocation;
import features.world.dungeonmap.application.runtime.DungeonRuntimeLocationTileResolver;
import features.world.dungeonmap.application.runtime.DungeonRuntimeNavigationService;
import features.world.dungeonmap.application.runtime.DungeonRuntimeNavigationSnapshot;
import features.world.dungeonmap.application.runtime.DungeonRuntimeStairDescriptor;
import features.world.dungeonmap.application.runtime.DungeonRuntimeTransitionDescriptor;
import features.world.dungeonmap.application.runtime.DungeonRuntimeSurface;
import features.world.dungeonmap.application.runtime.DungeonRuntimeSurfacePresenter;
import features.world.dungeonmap.application.runtime.DungeonRuntimeSurfaceResolver;
import features.world.dungeonmap.canvas.base.DungeonViewMode;
import features.world.dungeonmap.loading.DungeonMapLoadingService;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.shell.AbstractDungeonMapView;
import features.world.dungeonmap.shell.controls.DungeonLevelOverlayControls;
import features.world.dungeonmap.state.DungeonMapState;
import features.world.dungeonmap.state.DungeonRuntimeState;
import javafx.geometry.Insets;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
import ui.async.UiAsyncTasks;
import ui.shell.DetailsNavigator;
import ui.shell.NavigationIcons;

import java.util.List;
import java.util.Objects;

public final class DungeonRuntimeView extends AbstractDungeonMapView {

    private final String title;
    private final boolean editorMode;
    private final DungeonRuntimeNavigationService runtimeNavigationService;
    private final DetailsNavigator detailsNavigator;
    private final WorldTravelSurface travelSurface;
    private final DungeonRuntimeState runtimeState = new DungeonRuntimeState();
    private final VBox controls;
    private final Label zoomLabel = new Label();
    private final Label mapLabel = new Label();
    private final Label levelLabel = new Label();
    private final DungeonLevelOverlayControls overlayControls = new DungeonLevelOverlayControls(DungeonRuntimeView::sectionLabel);
    private long runtimeRequestSequence;
    private Long runtimeMapId;
    private DetailsNavigator.EntryKey lastPublishedSurfaceKey;

    public DungeonRuntimeView(
            String title,
            boolean editorMode,
            DungeonMapLoadingService loadingService,
            DungeonMapState state,
            DungeonRuntimeNavigationService runtimeNavigationService,
            DetailsNavigator detailsNavigator,
            WorldTravelSurface travelSurface
    ) {
        super(editorMode, loadingService, state);
        this.title = title;
        this.editorMode = editorMode;
        this.runtimeNavigationService = Objects.requireNonNull(runtimeNavigationService, "runtimeNavigationService");
        this.detailsNavigator = Objects.requireNonNull(detailsNavigator, "detailsNavigator");
        this.travelSurface = travelSurface;
        workspace().setViewMode(DungeonViewMode.GRID);
        workspace().setOnLevelScrollRequested(levelDelta ->
                state.setReachableProjectionLevel(state.activeProjectionLevel() + levelDelta));
        workspace().setInteractionHandler(new DungeonRuntimeInteractionController(
                state,
                runtimeState,
                tile -> {
                    CubePoint resolved = runtimeNavigationService.nearestTraversableTile(
                            state.activeMap(),
                            CubePoint.at(tile, state.activeProjectionLevel()));
                    return resolved == null ? null : resolved.projectedCell();
                },
                this::previewPartyTile,
                this::movePartyToTile));
        runtimeState.addListener(this::refreshRuntimeUi);
        Button upLevelButton = new Button("Ebene +");
        Button downLevelButton = new Button("Ebene -");
        upLevelButton.setOnAction(event -> state.setReachableProjectionLevel(state.activeProjectionLevel() + 1));
        downLevelButton.setOnAction(event -> state.setReachableProjectionLevel(state.activeProjectionLevel() - 1));
        overlayControls.setOnModeChanged(state::setLevelOverlayMode);
        overlayControls.setOnRangeChanged(state::setLevelOverlayRange);
        overlayControls.setOnOpacityChanged(state::setLevelOverlayOpacity);
        overlayControls.setOnSelectedLevelsChanged(state::setSelectedOverlayLevels);
        Region levelSpacer = new Region();
        HBox.setHgrow(levelSpacer, Priority.ALWAYS);
        HBox levelRow = new HBox(8, levelLabel, downLevelButton, upLevelButton, levelSpacer, overlayControls.trigger());
        this.controls = new VBox(10, zoomLabel, mapLabel, levelRow);
        this.controls.setPadding(new Insets(12));
        refreshRuntimeUi();
    }

    @Override
    public String getTitle() {
        return title;
    }

    @Override
    public Node getNavigationGraphic() {
        return editorMode ? NavigationIcons.dungeonEditor() : NavigationIcons.dungeon();
    }

    @Override
    public Node getControlsContent() {
        return controls;
    }

    @Override
    protected void onStateRefreshed() {
        refreshRuntimeState();
        refreshLabels();
    }

    @Override
    protected void onWorkspaceStateChanged() {
        refreshLabels();
    }

    private void refreshLabels() {
        zoomLabel.setText("Zoom: " + Math.round(workspace().zoom() * 100) + "%");
        mapLabel.setText(state().loading()
                ? "Lade Dungeon..."
                : state().errorMessage() != null
                ? state().errorMessage()
                : state().activeMap().name());
        levelLabel.setText("Ebene z=" + state().activeProjectionLevel());
        overlayControls.showSettings(state().levelOverlaySettings(), state().loading() || state().activeMapId() == null);
    }

    private void refreshRuntimeUi() {
        workspace().setActiveLocation(runtimeState.activeLocation());
        workspace().setHeading(runtimeState.heading());
        refreshLabels();
        refreshTravelPane();
        publishRoomDetails();
    }

    private void refreshRuntimeState() {
        if (state().loading()) {
            runtimeState.showLoading();
            return;
        }
        if (state().errorMessage() != null || state().activeMap().mapId() <= 0) {
            runtimeMapId = null;
            lastPublishedSurfaceKey = null;
            runtimeState.clear();
            return;
        }
        state().setReachableProjectionLevel(state().activeProjectionLevel());
        if (!Objects.equals(runtimeMapId, state().activeMapId())) {
            runtimeMapId = state().activeMapId();
            lastPublishedSurfaceKey = null;
            loadRuntimeNavigation();
            return;
        }
        applyNavigationSnapshot(runtimeNavigationService.resolveNavigation(
                state().activeMap(),
                runtimeState.activeLocation(),
                runtimeState.heading()));
    }

    private void loadRuntimeNavigation() {
        long requestId = ++runtimeRequestSequence;
        var layout = state().activeMap();
        runtimeState.showLoading();
        UiAsyncTasks.submit(
                () -> runtimeNavigationService.loadNavigation(layout),
                snapshot -> {
                    if (requestId != runtimeRequestSequence || !Objects.equals(runtimeMapId, state().activeMapId())) {
                        return;
                    }
                    applyNavigationSnapshot(snapshot);
                },
                failure -> {
                    if (requestId != runtimeRequestSequence) {
                        return;
                    }
                    System.err.println("DungeonRuntimeView.loadRuntimeNavigation(): " + failure.getMessage());
                    runtimeState.showFailure("Standort konnte nicht geladen werden");
                });
    }

    private void previewPartyTile(features.world.dungeonmap.model.geometry.Point2i tile) {
        if (tile == null) {
            runtimeState.clearDragPreview();
            return;
        }
        runtimeState.showDragPreview(DungeonRuntimeLocation.tile(CubePoint.at(tile, state().activeProjectionLevel())));
    }

    private void movePartyToTile(features.world.dungeonmap.model.geometry.Point2i tile) {
        if (runtimeState.loading() || runtimeState.moving() || state().activeMap().mapId() <= 0) {
            return;
        }
        var layout = state().activeMap();
        runtimeState.showMoveInProgress();
        UiAsyncTasks.submit(
                () -> runtimeNavigationService.moveToTile(
                        layout,
                        activeTile(),
                        CubePoint.at(tile, state().activeProjectionLevel()),
                        runtimeState.heading()),
                this::applyNavigationSnapshot,
                failure -> {
                    System.err.println("DungeonRuntimeView.movePartyToTile(): " + failure.getMessage());
                    runtimeState.showFailure("Standort konnte nicht gespeichert werden");
                });
    }

    private CubePoint activeTile() {
        DungeonRuntimeLocation location = runtimeState.activeLocation();
        return location instanceof DungeonRuntimeLocation.Tile tile ? tile.tile() : null;
    }

    private void movePartyThroughConnection(DungeonRuntimeDoorDescriptor door) {
        if (door == null || runtimeState.loading() || runtimeState.moving() || state().activeMap().mapId() <= 0) {
            return;
        }
        var layout = state().activeMap();
        int currentLevel = activeTile() != null ? activeTile().z() : state().activeProjectionLevel();
        runtimeState.showMoveInProgress();
        UiAsyncTasks.submit(
                () -> runtimeNavigationService.moveThroughConnection(layout, door, currentLevel),
                this::applyNavigationSnapshot,
                failure -> {
                    System.err.println("DungeonRuntimeView.movePartyThroughConnection(): " + failure.getMessage());
                    runtimeState.showFailure("Verbindung konnte nicht benutzt werden");
                });
    }

    private String runtimeStatusText() {
        if (runtimeState.loading()) {
            return "Standort wird geladen...";
        }
        if (runtimeState.moving()) {
            return "Gruppe bewegt sich...";
        }
        if (runtimeState.dragging()) {
            return "Token wird gezogen...";
        }
        if (runtimeState.errorMessage() != null) {
            return runtimeState.errorMessage();
        }
        return "Token auf der Karte ziehen";
    }

    private void refreshTravelPane() {
        if (travelSurface == null) {
            return;
        }
        travelSurface.showDungeonTravel(
                state().activeMap().name(),
                DungeonRuntimeLabels.activeLocationLabel(state().activeMap(), runtimeState.activeLocation()),
                DungeonRuntimeLabels.tileLabel(runtimeState.activeLocation()),
                DungeonRuntimeLabels.headingLabel(runtimeState.heading()),
                runtimeStatusText(),
                travelActions(),
                workspace()::resetView);
    }

    private List<WorldTravelSurface.DungeonDoorAction> travelActions() {
        DungeonRuntimeSurface surface = activeSurface();
        if (surface == null) {
            return List.of();
        }
        List<WorldTravelSurface.DungeonDoorAction> actions = new java.util.ArrayList<>();
        surface.doors().stream()
                .map(this::toConnectionAction)
                .forEach(actions::add);
        surface.stairs().stream()
                .map(this::toStairAction)
                .forEach(actions::add);
        surface.transitions().stream()
                .map(this::toTransitionAction)
                .forEach(actions::add);
        return List.copyOf(actions);
    }

    private WorldTravelSurface.DungeonDoorAction toStairAction(DungeonRuntimeStairDescriptor stair) {
        return new WorldTravelSurface.DungeonDoorAction(stair.displayLabel(), () -> movePartyThroughStair(stair));
    }

    private WorldTravelSurface.DungeonDoorAction toConnectionAction(DungeonRuntimeDoorDescriptor door) {
        return new WorldTravelSurface.DungeonDoorAction(door.displayLabel(), () -> movePartyThroughConnection(door));
    }

    private WorldTravelSurface.DungeonDoorAction toTransitionAction(DungeonRuntimeTransitionDescriptor transition) {
        return new WorldTravelSurface.DungeonDoorAction(transition.displayLabel(), () -> movePartyThroughTransition(transition));
    }

    private void movePartyThroughStair(DungeonRuntimeStairDescriptor stair) {
        if (stair == null || runtimeState.loading() || runtimeState.moving() || state().activeMap().mapId() <= 0) {
            return;
        }
        var layout = state().activeMap();
        runtimeState.showMoveInProgress();
        UiAsyncTasks.submit(
                () -> runtimeNavigationService.moveThroughStair(layout, stair, runtimeState.heading()),
                this::applyNavigationSnapshot,
                failure -> {
                    System.err.println("DungeonRuntimeView.movePartyThroughStair(): " + failure.getMessage());
                    runtimeState.showFailure("Treppe konnte nicht benutzt werden");
                });
    }

    private void movePartyThroughTransition(DungeonRuntimeTransitionDescriptor transition) {
        if (transition == null || runtimeState.loading() || runtimeState.moving() || state().activeMap().mapId() <= 0) {
            return;
        }
        var layout = state().activeMap();
        runtimeState.showMoveInProgress();
        UiAsyncTasks.submit(
                () -> runtimeNavigationService.moveThroughTransition(layout, transition, runtimeState.heading()),
                this::applyNavigationSnapshot,
                failure -> {
                    System.err.println("DungeonRuntimeView.movePartyThroughTransition(): " + failure.getMessage());
                    runtimeState.showFailure("Übergang konnte nicht benutzt werden");
                });
    }

    private void applyNavigationSnapshot(DungeonRuntimeNavigationSnapshot snapshot) {
        if (snapshot != null && snapshot.mapId() != null && !Objects.equals(snapshot.mapId(), state().activeMapId())) {
            runtimeState.showLoading();
            loadingService().loadMap(snapshot.mapId());
            return;
        }
        runtimeState.showNavigation(snapshot);
        CubePoint activeTile = DungeonRuntimeLocationTileResolver.resolve(state().activeMap(), runtimeState.activeLocation());
        if (activeTile != null) {
            state().setReachableProjectionLevel(activeTile.z());
        }
    }

    private void publishRoomDetails() {
        if (runtimeState.loading() || runtimeState.moving() || runtimeState.dragging()) {
            return;
        }
        DungeonRuntimeSurface surface = activeSurface();
        if (surface == null || surface.entryKey() == null) {
            return;
        }
        DetailsNavigator.EntryKey entryKey = surface.entryKey();
        boolean refreshCurrentCard = detailsNavigator.isShowing(entryKey);
        if (!refreshCurrentCard && Objects.equals(lastPublishedSurfaceKey, entryKey)) {
            return;
        }
        lastPublishedSurfaceKey = entryKey;
        detailsNavigator.showContent(surface.title(), entryKey, () -> DungeonRuntimeSurfacePresenter.buildNode(
                surface,
                this::movePartyThroughStair,
                this::movePartyThroughTransition));
    }

    private DungeonRuntimeSurface activeSurface() {
        return DungeonRuntimeSurfaceResolver.resolve(state().activeMap(), runtimeState.activeLocation(), runtimeState.heading());
    }

    private static Label sectionLabel(String text) {
        Label label = new Label(text);
        label.getStyleClass().addAll("section-header", "text-muted");
        return label;
    }
}
