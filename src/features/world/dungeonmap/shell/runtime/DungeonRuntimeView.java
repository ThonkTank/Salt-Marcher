package features.world.dungeonmap.shell.runtime;

import features.world.api.WorldTravelSurface;
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
import features.world.dungeonmap.canvas.base.DungeonDoorNumberOverlay;
import features.world.dungeonmap.canvas.base.DungeonRuntimeRenderOverlay;
import features.world.dungeonmap.canvas.base.DungeonViewMode;
import features.world.dungeonmap.loading.DungeonMapLoadingService;
import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.shell.AbstractDungeonMapView;
import features.world.dungeonmap.shell.controls.DungeonLevelOverlayControls;
import features.world.dungeonmap.shell.interaction.DungeonHitCollector;
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
    private final Runnable mapStateListener = this::onMapStateChanged;
    private long runtimeRequestSequence;
    private Long runtimeMapId;
    private DetailsNavigator.EntryKey lastPublishedSurfaceKey;
    private RuntimePresentation runtimePresentation = RuntimePresentation.empty();

    public DungeonRuntimeView(
            String title,
            boolean editorMode,
            DungeonMapLoadingService loadingService,
            DungeonMapState state,
            DungeonRuntimeNavigationService runtimeNavigationService,
            DetailsNavigator detailsNavigator,
            WorldTravelSurface travelSurface,
            DungeonHitCollector hitCollector
    ) {
        super(editorMode, loadingService, state);
        this.title = title;
        this.editorMode = editorMode;
        this.runtimeNavigationService = Objects.requireNonNull(runtimeNavigationService, "runtimeNavigationService");
        this.detailsNavigator = Objects.requireNonNull(detailsNavigator, "detailsNavigator");
        this.travelSurface = travelSurface;
        workspace().setViewMode(DungeonViewMode.GRID);
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
                this::movePartyToTile,
                hitCollector));
        workspace().setOnLevelScrollRequested(delta ->
                state.setReachableProjectionLevel(state.activeProjectionLevel() + delta));
        workspace().setOnStateChanged(this::refreshLabels);
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
    public void onShow() {
        super.onShow();
        state().addListener(mapStateListener);
        onMapStateChanged();
    }

    @Override
    public void onHide() {
        state().removeListener(mapStateListener);
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

    private void onMapStateChanged() {
        refreshRuntimeState();
        refreshLabels();
    }

    private void refreshLabels() {
        zoomLabel.setText("Zoom: " + Math.round(workspace().zoom() * 100) + "%");
        mapLabel.setText(state().mutationPending()
                ? "Speichere Dungeon..."
                : state().loading()
                ? "Lade Dungeon..."
                : state().errorMessage() != null && state().activeMap().mapId() <= 0
                ? state().errorMessage()
                : state().errorMessage() != null
                ? state().activeMap().name() + " | " + state().errorMessage()
                : state().activeMap().name());
        levelLabel.setText("Ebene z=" + state().activeProjectionLevel());
        overlayControls.showSettings(state().levelOverlaySettings(), state().busy() || state().activeMapId() == null);
    }

    private void refreshRuntimeUi() {
        runtimePresentation = resolveRuntimePresentation();
        publishRuntimePresentation(runtimePresentation);
        refreshLabels();
    }

    private void refreshRuntimeState() {
        if (state().busy()) {
            runtimeState.showLoading();
            return;
        }
        if (state().activeMap().mapId() <= 0) {
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
        return runtimePresentation.activeTile();
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

    private void publishRuntimePresentation(RuntimePresentation presentation) {
        RuntimePresentation resolvedPresentation = presentation == null ? RuntimePresentation.empty() : presentation;
        workspace().showRuntimeRenderOverlay(resolvedPresentation.overlay());
        refreshTravelPane(resolvedPresentation);
        publishRoomDetails(resolvedPresentation);
    }

    private void refreshTravelPane(RuntimePresentation presentation) {
        if (travelSurface == null) {
            return;
        }
        travelSurface.showDungeonTravel(
                state().activeMap().name(),
                DungeonRuntimeLabels.activeLocationLabel(state().activeMap(), runtimeState.activeLocation()),
                DungeonRuntimeLabels.tileLabel(presentation == null ? null : presentation.activeTile()),
                DungeonRuntimeLabels.headingLabel(runtimeState.heading()),
                runtimeStatusText(),
                travelActions(presentation),
                workspace()::resetView);
    }

    private List<WorldTravelSurface.DungeonDoorAction> travelActions(RuntimePresentation presentation) {
        DungeonRuntimeSurface surface = presentation == null ? null : presentation.surface();
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

    private void publishRoomDetails(RuntimePresentation presentation) {
        DungeonRuntimeSurface surface = presentation == null ? null : presentation.surface();
        if (runtimeState.loading() || runtimeState.moving() || runtimeState.dragging()) {
            return;
        }
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

    private RuntimePresentation resolveRuntimePresentation() {
        DungeonRuntimeLocation location = runtimeState.activeLocation();
        var layout = state().activeMap();
        CardinalDirection heading = runtimeState.heading();
        if (location == null || layout == null) {
            return RuntimePresentation.empty();
        }
        CubePoint activeTile = DungeonRuntimeLocationTileResolver.resolve(layout, location);
        if (activeTile == null) {
            return RuntimePresentation.empty();
        }
        DungeonRuntimeSurface surface = DungeonRuntimeSurfaceResolver.resolve(layout, location, activeTile, heading);
        List<DungeonDoorNumberOverlay> doorNumbers = surface == null
                ? List.of()
                : surface.doors().stream()
                        .map(door -> new DungeonDoorNumberOverlay(door.number(), door.anchorSegment2x()))
                        .toList();
        return new RuntimePresentation(
                surface,
                activeTile,
                new DungeonRuntimeRenderOverlay(activeTile, heading, doorNumbers));
    }

    private static Label sectionLabel(String text) {
        Label label = new Label(text);
        label.getStyleClass().addAll("section-header", "text-muted");
        return label;
    }

    private record RuntimePresentation(
            DungeonRuntimeSurface surface,
            CubePoint activeTile,
            DungeonRuntimeRenderOverlay overlay
    ) {
        private RuntimePresentation {
            overlay = overlay == null ? DungeonRuntimeRenderOverlay.empty() : overlay;
        }

        private static RuntimePresentation empty() {
            return new RuntimePresentation(null, null, DungeonRuntimeRenderOverlay.empty());
        }
    }
}
