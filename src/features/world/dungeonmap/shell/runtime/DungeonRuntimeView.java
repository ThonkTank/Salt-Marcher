package features.world.dungeonmap.shell.runtime;

import features.world.api.WorldTravelSurface;
import features.world.dungeonmap.application.runtime.DungeonRuntimeAction;
import features.world.dungeonmap.application.runtime.DungeonRuntimeApplicationService;
import features.world.dungeonmap.application.runtime.DungeonRuntimeDoorDescriptor;
import features.world.dungeonmap.application.runtime.DungeonRuntimeLabels;
import features.world.dungeonmap.application.runtime.DungeonRuntimeLocation;
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
import features.world.dungeonmap.model.geometry.CellCoord;
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
    private final DungeonRuntimeApplicationService runtimeApplicationService;
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
    private DungeonRuntimeNavigationSnapshot pendingNavigationSnapshot;
    private DetailsNavigator.EntryKey lastPublishedSurfaceKey;
    private RuntimePresentation runtimePresentation = RuntimePresentation.empty();

    public DungeonRuntimeView(
            String title,
            boolean editorMode,
            DungeonMapLoadingService loadingService,
            DungeonMapState state,
            DungeonRuntimeApplicationService runtimeApplicationService,
            DetailsNavigator detailsNavigator,
            WorldTravelSurface travelSurface,
            DungeonHitCollector hitCollector
    ) {
        super(editorMode, loadingService, state);
        this.title = title;
        this.editorMode = editorMode;
        this.runtimeApplicationService = Objects.requireNonNull(runtimeApplicationService, "runtimeApplicationService");
        this.detailsNavigator = Objects.requireNonNull(detailsNavigator, "detailsNavigator");
        this.travelSurface = travelSurface;
        workspace().setViewMode(DungeonViewMode.GRID);
        workspace().setInteractionHandler(new DungeonRuntimeInteractionController(
                state,
                runtimeState,
                cell -> state.activeMap().nearestTraversableCell(cell, state.activeProjectionLevel()),
                this::previewPartyCell,
                this::movePartyToCell,
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
            pendingNavigationSnapshot = null;
            lastPublishedSurfaceKey = null;
            runtimeState.clear();
            return;
        }
        state().setReachableProjectionLevel(state().activeProjectionLevel());
        if (pendingNavigationSnapshot != null
                && !Objects.equals(pendingNavigationSnapshot.mapId(), state().activeMapId())
                && !state().loading()) {
            pendingNavigationSnapshot = null;
        }
        if (!Objects.equals(runtimeMapId, state().activeMapId())) {
            runtimeMapId = state().activeMapId();
            lastPublishedSurfaceKey = null;
            if (pendingNavigationSnapshot != null && Objects.equals(pendingNavigationSnapshot.mapId(), runtimeMapId)) {
                DungeonRuntimeNavigationSnapshot snapshot = pendingNavigationSnapshot;
                pendingNavigationSnapshot = null;
                applyNavigationSnapshot(runtimeApplicationService.resolveNavigation(state().activeMap(), snapshot));
                return;
            }
            loadRuntimeNavigation();
            return;
        }
        applyNavigationSnapshot(runtimeApplicationService.resolveNavigation(
                state().activeMap(),
                runtimeState.activeLocation(),
                runtimeState.heading()));
    }

    private void loadRuntimeNavigation() {
        long requestId = ++runtimeRequestSequence;
        var layout = state().activeMap();
        runtimeState.showLoading();
        UiAsyncTasks.submit(
                () -> runtimeApplicationService.loadNavigation(layout),
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

    private void previewPartyCell(CellCoord cell) {
        if (cell == null) {
            runtimeState.clearDragPreview();
            return;
        }
        runtimeState.showDragPreview(DungeonRuntimeLocation.cell(cell, state().activeProjectionLevel()));
    }

    private void movePartyToCell(CellCoord cell) {
        if (runtimeState.loading() || runtimeState.moving() || state().activeMap().mapId() <= 0) {
            return;
        }
        var layout = state().activeMap();
        runtimeState.showMoveInProgress();
        UiAsyncTasks.submit(
                () -> runtimeApplicationService.navigateToCell(
                        layout,
                        activeCell(),
                        cell,
                        state().activeProjectionLevel(),
                        runtimeState.heading()),
                this::applyNavigationSnapshot,
                failure -> {
                    System.err.println("DungeonRuntimeView.movePartyToCell(): " + failure.getMessage());
                    runtimeState.showFailure("Standort konnte nicht gespeichert werden");
                });
    }

    private CellCoord activeCell() {
        return runtimePresentation.activeCell();
    }

    private int activeLevelZ() {
        return runtimePresentation.activeLevelZ();
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
                DungeonRuntimeLabels.activeLocationLabel(
                        state().activeMap(),
                        presentation == null ? null : presentation.activeCell(),
                        presentation == null ? state().activeProjectionLevel() : presentation.activeLevelZ()),
                DungeonRuntimeLabels.cellLabel(
                        presentation == null ? null : presentation.activeCell(),
                        presentation == null ? state().activeProjectionLevel() : presentation.activeLevelZ()),
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
        return surface.actions().stream()
                .map(this::toTravelAction)
                .toList();
    }

    private WorldTravelSurface.DungeonDoorAction toTravelAction(DungeonRuntimeAction action) {
        return new WorldTravelSurface.DungeonDoorAction(action.displayLabel(), () -> triggerRuntimeAction(action));
    }

    private void triggerRuntimeAction(DungeonRuntimeAction action) {
        if (action == null || runtimeState.loading() || runtimeState.moving() || state().activeMap().mapId() <= 0) {
            return;
        }
        var layout = state().activeMap();
        int currentLevel = activeCell() != null ? activeLevelZ() : state().activeProjectionLevel();
        runtimeState.showMoveInProgress();
        UiAsyncTasks.submit(
                () -> runtimeApplicationService.navigate(layout, action, runtimeState.heading(), currentLevel),
                this::applyNavigationSnapshot,
                failure -> {
                    System.err.println("DungeonRuntimeView.triggerRuntimeAction(): " + failure.getMessage());
                    runtimeState.showFailure(actionFailureMessage(action));
                });
    }

    private static String actionFailureMessage(DungeonRuntimeAction action) {
        if (action instanceof DungeonRuntimeDoorDescriptor) {
            return "Verbindung konnte nicht benutzt werden";
        }
        if (action instanceof DungeonRuntimeStairDescriptor) {
            return "Treppe konnte nicht benutzt werden";
        }
        if (action instanceof DungeonRuntimeTransitionDescriptor) {
            return "Übergang konnte nicht benutzt werden";
        }
        return "Aktion konnte nicht ausgeführt werden";
    }

    private void applyNavigationSnapshot(DungeonRuntimeNavigationSnapshot snapshot) {
        if (snapshot != null && snapshot.mapId() != null && !Objects.equals(snapshot.mapId(), state().activeMapId())) {
            pendingNavigationSnapshot = snapshot;
            runtimeState.showLoading();
            loadingService().selectMap(snapshot.mapId());
            return;
        }
        pendingNavigationSnapshot = null;
        runtimeState.showNavigation(snapshot);
        if (runtimeState.activeLocation() instanceof DungeonRuntimeLocation.Cell cellLocation) {
            state().setReachableProjectionLevel(cellLocation.levelZ());
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
                this::triggerRuntimeAction));
    }

    private RuntimePresentation resolveRuntimePresentation() {
        DungeonRuntimeLocation location = runtimeState.activeLocation();
        var layout = state().activeMap();
        CardinalDirection heading = runtimeState.heading();
        if (location == null || layout == null) {
            return RuntimePresentation.empty();
        }
        if (!(location instanceof DungeonRuntimeLocation.Cell cellLocation)) {
            return RuntimePresentation.empty();
        }
        DungeonRuntimeSurface surface = DungeonRuntimeSurfaceResolver.resolve(
                layout,
                cellLocation.cell(),
                cellLocation.levelZ(),
                heading);
        List<DungeonDoorNumberOverlay> doorNumbers = surface == null
                ? List.of()
                : surface.actions().stream()
                        .filter(DungeonRuntimeDoorDescriptor.class::isInstance)
                        .map(DungeonRuntimeDoorDescriptor.class::cast)
                        .map(door -> new DungeonDoorNumberOverlay(door.number(), door.anchorSegment2x()))
                        .toList();
        return new RuntimePresentation(
                surface,
                cellLocation.cell(),
                cellLocation.levelZ(),
                new DungeonRuntimeRenderOverlay(cellLocation.cell(), cellLocation.levelZ(), heading, doorNumbers));
    }

    private static Label sectionLabel(String text) {
        Label label = new Label(text);
        label.getStyleClass().addAll("section-header", "text-muted");
        return label;
    }

    private record RuntimePresentation(
            DungeonRuntimeSurface surface,
            CellCoord activeCell,
            int activeLevelZ,
            DungeonRuntimeRenderOverlay overlay
    ) {
        private RuntimePresentation {
            overlay = overlay == null ? DungeonRuntimeRenderOverlay.empty() : overlay;
        }

        private static RuntimePresentation empty() {
            return new RuntimePresentation(null, null, 0, DungeonRuntimeRenderOverlay.empty());
        }
    }
}
