package features.world.dungeon.shell.runtime.surface;

import features.world.api.input.TravelSurfaceInput;
import features.world.dungeon.application.runtime.DungeonRuntimeAction;
import features.world.dungeon.application.runtime.DungeonRuntimeActionResolver;
import features.world.dungeon.application.runtime.DungeonRuntimeApplicationService;
import features.world.dungeon.application.runtime.DungeonRuntimeLocation;
import features.world.dungeon.application.runtime.DungeonRuntimeNavigationSnapshot;
import features.world.dungeon.application.runtime.description.DungeonRuntimeDescription;
import features.world.dungeon.application.runtime.description.DungeonRuntimeDescriptionResolver;
import features.world.dungeon.canvas.base.DungeonCanvasCamera;
import features.world.dungeon.canvas.base.DungeonCanvasInteractionHandler;
import features.world.dungeon.canvas.base.DungeonCanvasPointerEvent;
import features.world.dungeon.canvas.base.DungeonCanvasTheme;
import features.world.dungeon.canvas.base.DungeonRuntimeRenderOverlay;
import features.world.dungeon.dungeonmap.DungeonMapObject;
import features.world.dungeon.dungeonmap.input.SelectMapInput;
import features.world.dungeon.dungeonmap.model.DungeonMap;
import features.world.dungeon.geometry.CardinalDirection;
import features.world.dungeon.geometry.GridPoint;
import features.world.dungeon.model.interaction.DungeonSelectionRef;
import features.world.dungeon.shell.AbstractDungeonMapView;
import features.world.dungeon.shell.controls.DungeonLevelOverlayControls;
import features.world.dungeon.shell.interaction.DungeonDragService;
import features.world.dungeon.shell.interaction.DungeonHitCollector;
import features.world.dungeon.shell.interaction.DungeonHitProbe;
import features.world.dungeon.shell.interaction.DungeonHitSnapshot;
import features.world.dungeon.shell.runtime.DungeonRuntimeDescriptionPane;
import features.world.dungeon.shell.runtime.DungeonRuntimeSelectionPolicy;
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
import java.util.function.Consumer;
import java.util.function.Function;

/**
 * Shell wiring for the dungeon runtime surface.
 *
 * <p>The view resolves one shared runtime location per refresh pass, publishes read-only details from that location,
 * and delegates executable travel to runtime application owners. Runtime workflow state stays in shared state, not in
 * view-local mirrors.</p>
 */
@SuppressWarnings("unused")
public final class SurfaceObject extends AbstractDungeonMapView {

    private final String title;
    private final boolean editorMode;
    private final DungeonRuntimeApplicationService runtimeApplicationService;
    private final DetailsNavigator detailsNavigator;
    private final TravelSurfaceInput travelSurface;
    private final features.world.dungeon.state.DungeonRuntimeState runtimeState =
            new features.world.dungeon.state.DungeonRuntimeState();
    private final VBox controls;
    private final Label zoomLabel = new Label();
    private final Label mapLabel = new Label();
    private final Label levelLabel = new Label();
    private final DungeonLevelOverlayControls overlayControls = new DungeonLevelOverlayControls(SurfaceObject::sectionLabel);
    private final Runnable mapStateListener = this::onMapStateChanged;
    private long runtimeRequestSequence;
    private Long runtimeMapId;
    private DungeonSelectionRef lastPublishedOwnerRef;

    public SurfaceObject(
            String title,
            boolean editorMode,
            DungeonMapObject mapObject,
            features.world.dungeon.dungeonmap.state.DungeonMapState state,
            DungeonRuntimeApplicationService runtimeApplicationService,
            DetailsNavigator detailsNavigator,
            TravelSurfaceInput travelSurface,
            DungeonHitCollector hitCollector
    ) {
        super(editorMode, mapObject, state);
        this.title = title;
        this.editorMode = editorMode;
        this.runtimeApplicationService = Objects.requireNonNull(runtimeApplicationService, "runtimeApplicationService");
        this.detailsNavigator = Objects.requireNonNull(detailsNavigator, "detailsNavigator");
        this.travelSurface = travelSurface;
        workspace().setViewMode(features.world.dungeon.state.DungeonViewMode.GRID);
        workspace().setInteractionHandler(new RuntimeInteractionController(
                cell -> state.activeMap().nearestTraversableCell(cell, state.activeProjectionLevel()),
                this::previewPartyNavigation,
                this::movePartyToNavigation,
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
        DungeonRuntimeLocation location = resolveRuntimeLocation();
        DungeonRuntimeDescription description = DungeonRuntimeDescriptionResolver.resolve(location);
        List<DungeonRuntimeAction> actions = DungeonRuntimeActionResolver.resolve(
                location,
                description == null ? List.of() : description.exits());
        workspace().showRuntimeRenderOverlay(DungeonRuntimeRenderOverlay.from(runtimeState.activeNavigation(), description));
        refreshTravelPane(description, actions);
        publishRuntimeDetails(description, actions);
        refreshLabels();
    }

    private void refreshRuntimeState() {
        if (state().busy()) {
            runtimeState.showLoading();
            return;
        }
        if (state().activeMap().mapId() <= 0) {
            runtimeMapId = null;
            lastPublishedOwnerRef = null;
            runtimeState.clear();
            return;
        }
        state().setReachableProjectionLevel(state().activeProjectionLevel());
        if (runtimeState.pendingNavigation() != null
                && !Objects.equals(runtimeState.pendingNavigation().mapId(), state().activeMapId())
                && !state().loading()) {
            runtimeState.clearPendingNavigation();
        }
        if (!Objects.equals(runtimeMapId, state().activeMapId())) {
            runtimeMapId = state().activeMapId();
            lastPublishedOwnerRef = null;
            if (runtimeState.pendingNavigation() != null && Objects.equals(runtimeState.pendingNavigation().mapId(), runtimeMapId)) {
                applyNavigationSnapshot(runtimeApplicationService.resolveNavigation(
                        state().activeMap(),
                        runtimeState.pendingNavigation()));
                return;
            }
            loadRuntimeNavigation();
            return;
        }
        applyNavigationSnapshot(runtimeApplicationService.resolveNavigation(
                state().activeMap(),
                runtimeState.activeNavigation()));
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
                    System.err.println("SurfaceObject.loadRuntimeNavigation(): " + failure.getMessage());
                    runtimeState.showFailure("Standort konnte nicht geladen werden");
                });
    }

    private void previewPartyNavigation(DungeonRuntimeNavigationSnapshot navigation) {
        if (navigation == null || navigation.cell() == null) {
            runtimeState.clearDragPreview();
            return;
        }
        runtimeState.showDragPreview(navigation);
    }

    private void movePartyToNavigation(DungeonRuntimeNavigationSnapshot navigation) {
        if (runtimeState.loading()
                || runtimeState.moving()
                || state().activeMap().mapId() <= 0
                || navigation == null
                || navigation.cell() == null) {
            return;
        }
        var layout = state().activeMap();
        runtimeState.showMoveInProgress();
        UiAsyncTasks.submit(
                () -> runtimeApplicationService.navigateToCell(
                        layout,
                        runtimeState.persistedNavigation(),
                        navigation.cell(),
                        navigation.levelZ()),
                this::applyNavigationSnapshot,
                failure -> {
                    System.err.println("SurfaceObject.movePartyToNavigation(): " + failure.getMessage());
                    runtimeState.showFailure("Standort konnte nicht gespeichert werden");
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

    private void refreshTravelPane(
            DungeonRuntimeDescription description,
            List<DungeonRuntimeAction> actions
    ) {
        if (travelSurface == null) {
            return;
        }
        DungeonRuntimeNavigationSnapshot navigation = runtimeState.activeNavigation();
        travelSurface.showDungeonTravel(new TravelSurfaceInput.DungeonTravelPresentationInput(
                state().activeMap().name(),
                description == null ? "Kein Standort" : description.title(),
                cellLabel(navigation.cell(), navigation.levelZ()),
                headingLabel(navigation.heading()),
                runtimeStatusText(),
                travelActions(actions),
                workspace()::resetView));
    }

    private List<TravelSurfaceInput.DungeonTravelActionInput> travelActions(List<DungeonRuntimeAction> actions) {
        if (actions == null || actions.isEmpty()) {
            return List.of();
        }
        return actions.stream()
                .map(this::toTravelAction)
                .toList();
    }

    private TravelSurfaceInput.DungeonTravelActionInput toTravelAction(DungeonRuntimeAction action) {
        return new TravelSurfaceInput.DungeonTravelActionInput(action.label(), () -> triggerRuntimeAction(action));
    }

    private void triggerRuntimeAction(DungeonRuntimeAction action) {
        if (action == null || runtimeState.loading() || runtimeState.moving() || state().activeMap().mapId() <= 0) {
            return;
        }
        var layout = state().activeMap();
        runtimeState.showMoveInProgress();
        UiAsyncTasks.submit(
                () -> runtimeApplicationService.navigate(layout, runtimeState.persistedNavigation(), action),
                this::applyNavigationSnapshot,
                failure -> {
                    System.err.println("SurfaceObject.triggerRuntimeAction(): " + failure.getMessage());
                    runtimeState.showFailure(action.failureMessage());
                });
    }

    private void applyNavigationSnapshot(DungeonRuntimeNavigationSnapshot snapshot) {
        if (snapshot != null && snapshot.mapId() != null && !Objects.equals(snapshot.mapId(), state().activeMapId())) {
            runtimeState.showPendingNavigation(snapshot);
            mapObject().selectMap(new SelectMapInput(snapshot.mapId()));
            return;
        }
        runtimeState.showNavigation(snapshot);
        if (snapshot != null && snapshot.cell() != null) {
            state().setReachableProjectionLevel(snapshot.levelZ());
        }
    }

    private void publishRuntimeDetails(
            DungeonRuntimeDescription description,
            List<DungeonRuntimeAction> actions
    ) {
        if (runtimeState.loading() || runtimeState.moving() || runtimeState.dragging()) {
            return;
        }
        if (description == null || description.ownerRef() == null) {
            return;
        }
        DetailsNavigator.EntryKey entryKey = new DetailsNavigator.EntryKey("dungeon-runtime", description.ownerRef());
        boolean refreshCurrentCard = detailsNavigator.isShowing(entryKey);
        if (!refreshCurrentCard && Objects.equals(lastPublishedOwnerRef, description.ownerRef())) {
            return;
        }
        lastPublishedOwnerRef = description.ownerRef();
        detailsNavigator.showContent(description.title(), entryKey, () -> new DungeonRuntimeDescriptionPane(
                description,
                actions,
                this::triggerRuntimeAction));
    }

    private DungeonRuntimeLocation resolveRuntimeLocation() {
        DungeonRuntimeNavigationSnapshot navigation = runtimeState.activeNavigation();
        var layout = state().activeMap();
        if (layout == null || navigation == null || navigation.isEmpty()) {
            return null;
        }
        return DungeonRuntimeLocation.resolve(layout, navigation);
    }

    private static Label sectionLabel(String text) {
        Label label = new Label(text);
        label.getStyleClass().addAll("section-header", "text-muted");
        return label;
    }

    private static String cellLabel(GridPoint cell, int levelZ) {
        return cell == null ? "—" : (cell.x2() / 2) + ", " + (cell.y2() / 2) + ", z=" + levelZ;
    }

    private static String headingLabel(CardinalDirection heading) {
        CardinalDirection resolvedHeading = heading == null ? CardinalDirection.defaultDirection() : heading;
        return resolvedHeading.label();
    }

    private final class RuntimeInteractionController implements DungeonCanvasInteractionHandler {

        private final Function<GridPoint, GridPoint> nearestTraversableCell;
        private final Consumer<DungeonRuntimeNavigationSnapshot> previewHandler;
        private final Consumer<DungeonRuntimeNavigationSnapshot> moveHandler;
        private final DungeonHitCollector hitCollector;
        private final DungeonRuntimeSelectionPolicy selectionPolicy = new DungeonRuntimeSelectionPolicy();
        private final DungeonDragService dragService = new DungeonDragService();
        private final PlacementValidator placementValidator = new PlacementValidator();

        private DungeonDragService.DungeonDragSession dragSession;

        private RuntimeInteractionController(
                Function<GridPoint, GridPoint> nearestTraversableCell,
                Consumer<DungeonRuntimeNavigationSnapshot> previewHandler,
                Consumer<DungeonRuntimeNavigationSnapshot> moveHandler,
                DungeonHitCollector hitCollector
        ) {
            this.nearestTraversableCell = Objects.requireNonNull(nearestTraversableCell, "nearestTraversableCell");
            this.previewHandler = Objects.requireNonNull(previewHandler, "previewHandler");
            this.moveHandler = Objects.requireNonNull(moveHandler, "moveHandler");
            this.hitCollector = Objects.requireNonNull(hitCollector, "hitCollector");
        }

        @Override
        public boolean handlePressed(DungeonCanvasPointerEvent event, DungeonCanvasCamera camera) {
            if (!interactionEnabled() || event == null) {
                dragSession = null;
                return false;
            }
            DungeonHitSnapshot hitSnapshot = collect(event, camera);
            if (hitSnapshot == null) {
                dragSession = null;
                return false;
            }
            DungeonMap activeMap = activeMap();
            if (!selectionPolicy.canBeginDrag(activeMap, event, hitSnapshot, runtimeState.activeNavigation())) {
                dragSession = null;
                return false;
            }
            GridPoint activeCell = runtimeState.activeNavigation().cell();
            if (activeCell == null) {
                dragSession = null;
                return false;
            }
            DungeonDragService.DungeonDragResult result = dragService.begin(
                    event,
                    new DungeonDragService.DungeonDragTarget.TileDragTarget(activeCell));
            if (result instanceof DungeonDragService.DungeonDragResult.Started started) {
                dragSession = started.session();
                previewHandler.accept(navigationAt(started.session().currentCell(), hitSnapshot.probe().levelZ()));
                return true;
            }
            dragSession = null;
            return false;
        }

        @Override
        public boolean handleDragged(DungeonCanvasPointerEvent event, DungeonCanvasCamera camera) {
            if (dragSession == null || event == null) {
                return false;
            }
            DungeonHitSnapshot hitSnapshot = collect(event, camera);
            if (hitSnapshot == null || !selectionPolicy.canContinueDrag(event, dragSession)) {
                return false;
            }
            DungeonDragService.DungeonDragResult result = dragService.update(event, dragSession, nearestTraversableCell);
            if (result instanceof DungeonDragService.DungeonDragResult.Updated updated
                    && placementValidator.validateTraversable(
                    activeMap(),
                    updated.session().currentCell(),
                    hitSnapshot.probe().levelZ()) instanceof PlacementValidator.PlacementResult.Valid valid) {
                dragSession = updated.session();
                previewHandler.accept(navigationAt(valid.cell(), hitSnapshot.probe().levelZ()));
                return true;
            }
            return false;
        }

        @Override
        public boolean handleReleased(DungeonCanvasPointerEvent event, DungeonCanvasCamera camera) {
            if (dragSession == null || event == null) {
                return false;
            }
            DungeonHitSnapshot hitSnapshot = collect(event, camera);
            DungeonDragService.DungeonDragSession currentSession = dragSession;
            dragSession = null;
            if (hitSnapshot == null) {
                runtimeState.clearDragPreview();
                return false;
            }
            if (selectionPolicy.canDrop(currentSession)) {
                DungeonDragService.DungeonDragResult result = dragService.drop(event, currentSession, nearestTraversableCell);
                if (result instanceof DungeonDragService.DungeonDragResult.Dropped dropped
                        && placementValidator.validateTraversable(
                        activeMap(),
                        dropped.session().currentCell(),
                        hitSnapshot.probe().levelZ()) instanceof PlacementValidator.PlacementResult.Valid valid) {
                    moveHandler.accept(navigationAt(valid.cell(), hitSnapshot.probe().levelZ()));
                    return true;
                }
            }
            runtimeState.clearDragPreview();
            return false;
        }

        private DungeonHitSnapshot collect(DungeonCanvasPointerEvent event, DungeonCanvasCamera camera) {
            if (event == null || event.canvasPoint() == null || event.gridCell() == null || camera == null) {
                return null;
            }
            DungeonMap activeMap = activeMap();
            double gridSize = DungeonCanvasTheme.BASE_GRID * camera.zoom();
            DungeonHitProbe probe = new DungeonHitProbe(
                    event.canvasPoint(),
                    event.gridCell(),
                    DungeonHitProbe.gridPointForCanvas(event.canvasPoint(), camera.panX(), camera.panY(), gridSize),
                    state().activeProjectionLevel(),
                    camera.panX(),
                    camera.panY(),
                    gridSize);
            return hitCollector.collect(activeMap, probe);
        }

        private boolean interactionEnabled() {
            return !state().busy() && !runtimeState.loading() && !runtimeState.moving();
        }

        private DungeonMap activeMap() {
            DungeonMap layout = state().activeMap();
            return layout == null ? DungeonMap.empty() : layout;
        }

        private DungeonRuntimeNavigationSnapshot navigationAt(GridPoint cell, int levelZ) {
            Long mapId = state().activeMapId();
            return new DungeonRuntimeNavigationSnapshot(mapId, cell, levelZ, runtimeState.activeNavigation().heading());
        }
    }

    private static final class PlacementValidator {

        private sealed interface PlacementResult permits PlacementResult.Valid, PlacementResult.Invalid {

            record Valid(GridPoint cell, int level) implements PlacementResult {
                public Valid {
                    Objects.requireNonNull(cell, "cell");
                }
            }

            record Invalid(GridPoint cell, int level, String reason) implements PlacementResult {
                public Invalid {
                    Objects.requireNonNull(cell, "cell");
                    Objects.requireNonNull(reason, "reason");
                }
            }
        }

        private PlacementResult validateTraversable(
                DungeonMap layout,
                GridPoint cell,
                int level
        ) {
            if (layout == null || cell == null) {
                return null;
            }
            if (!layout.isTraversableCell(cell, level)) {
                return new PlacementResult.Invalid(cell, level, "Zelle ist nicht begehbar.");
            }
            return new PlacementResult.Valid(cell, level);
        }
    }
}
