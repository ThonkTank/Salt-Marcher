package features.world.dungeonmap.shell.runtime;

import features.world.api.WorldTravelSurface;
import features.world.dungeonmap.application.runtime.DungeonHeading;
import features.world.dungeonmap.application.runtime.DungeonRuntimeDoorCatalog;
import features.world.dungeonmap.application.runtime.DungeonRuntimeDoorDescriptor;
import features.world.dungeonmap.application.runtime.DungeonRuntimeLabels;
import features.world.dungeonmap.application.runtime.DungeonRuntimeLocation;
import features.world.dungeonmap.application.runtime.DungeonRuntimeNavigationService;
import features.world.dungeonmap.application.runtime.DungeonRuntimeSurface;
import features.world.dungeonmap.application.runtime.DungeonRuntimeSurfacePresenter;
import features.world.dungeonmap.application.runtime.DungeonRuntimeSurfaceResolver;
import features.world.dungeonmap.canvas.base.DungeonViewMode;
import features.world.dungeonmap.loading.DungeonMapLoadingService;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.state.DungeonMapState;
import features.world.dungeonmap.state.DungeonRuntimeState;
import features.world.dungeonmap.shell.AbstractDungeonMapView;
import javafx.geometry.Insets;
import javafx.scene.Node;
import javafx.scene.control.Label;
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
        workspace().setInteractionHandler(new DungeonRuntimeInteractionController(
                state,
                runtimeState,
                tile -> runtimeNavigationService.nearestTraversableTile(state.activeMap(), tile),
                this::previewPartyTile,
                this::movePartyToTile));
        runtimeState.addListener(this::refreshRuntimeUi);
        this.controls = new VBox(10, zoomLabel, mapLabel);
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
        if (!Objects.equals(runtimeMapId, state().activeMapId())) {
            runtimeMapId = state().activeMapId();
            lastPublishedSurfaceKey = null;
            loadRuntimeNavigation();
            return;
        }
        runtimeState.showNavigation(runtimeNavigationService.resolveNavigation(
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
                    runtimeState.showNavigation(snapshot);
                },
                failure -> {
                    if (requestId != runtimeRequestSequence) {
                        return;
                    }
                    System.err.println("DungeonRuntimeView.loadRuntimeNavigation(): " + failure.getMessage());
                    runtimeState.showFailure("Standort konnte nicht geladen werden");
                });
    }

    private void previewPartyTile(Point2i tile) {
        if (tile == null) {
            runtimeState.clearDragPreview();
            return;
        }
        runtimeState.showDragPreview(DungeonRuntimeLocation.tile(tile));
    }

    private void movePartyToTile(Point2i tile) {
        if (runtimeState.loading() || runtimeState.moving() || state().activeMap().mapId() <= 0) {
            return;
        }
        var layout = state().activeMap();
        runtimeState.showMoveInProgress();
        UiAsyncTasks.submit(
                () -> runtimeNavigationService.moveToTile(layout, activeTile(), tile, runtimeState.heading()),
                runtimeState::showNavigation,
                failure -> {
                    System.err.println("DungeonRuntimeView.movePartyToTile(): " + failure.getMessage());
                    runtimeState.showFailure("Standort konnte nicht gespeichert werden");
                });
    }

    private Point2i activeTile() {
        DungeonRuntimeLocation location = runtimeState.activeLocation();
        return location instanceof DungeonRuntimeLocation.Tile tile ? tile.tile() : null;
    }

    private void movePartyThroughDoor(DungeonRuntimeDoorDescriptor door) {
        if (door == null || runtimeState.loading() || runtimeState.moving() || state().activeMap().mapId() <= 0) {
            return;
        }
        var layout = state().activeMap();
        DungeonRuntimeSurface surface = activeSurface();
        if (surface == null) {
            return;
        }
        runtimeState.showMoveInProgress();
        UiAsyncTasks.submit(
                () -> runtimeNavigationService.moveThroughDoor(layout, surface, door),
                runtimeState::showNavigation,
                failure -> {
                    System.err.println("DungeonRuntimeView.movePartyThroughDoor(): " + failure.getMessage());
                    runtimeState.showFailure("Tür konnte nicht benutzt werden");
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
                travelDoorActions(),
                workspace()::resetView);
    }

    private List<WorldTravelSurface.DungeonDoorAction> travelDoorActions() {
        DungeonRuntimeSurface surface = activeSurface();
        if (surface == null) {
            return List.of();
        }
        return surface.doors().stream()
                .map(this::toDoorAction)
                .toList();
    }

    private WorldTravelSurface.DungeonDoorAction toDoorAction(DungeonRuntimeDoorDescriptor door) {
        return new WorldTravelSurface.DungeonDoorAction(door.displayLabel(), () -> movePartyThroughDoor(door));
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
        detailsNavigator.showContent(surface.title(), entryKey, () -> DungeonRuntimeSurfacePresenter.buildNode(surface));
    }

    private DungeonRuntimeSurface activeSurface() {
        return DungeonRuntimeSurfaceResolver.resolve(state().activeMap(), runtimeState.activeLocation(), runtimeState.heading());
    }
}
