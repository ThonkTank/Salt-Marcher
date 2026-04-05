package features.world.dungeonmap.shell.runtime;

import features.world.api.WorldTravelSurface;
import features.world.dungeonmap.application.runtime.DungeonRuntimeAction;
import features.world.dungeonmap.application.runtime.DungeonRuntimeApplicationService;
import features.world.dungeonmap.application.runtime.DungeonRuntimeNavigationSnapshot;
import features.world.dungeonmap.application.runtime.description.DungeonRuntimeDescription;
import features.world.dungeonmap.application.runtime.description.DungeonRuntimeDescriptionRef;
import features.world.dungeonmap.application.runtime.description.DungeonRuntimeDescriptionResolver;
import features.world.dungeonmap.canvas.base.DungeonRuntimeRenderOverlay;
import features.world.dungeonmap.loading.DungeonMapLoadingService;
import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.shell.AbstractDungeonMapView;
import features.world.dungeonmap.shell.controls.DungeonLevelOverlayControls;
import features.world.dungeonmap.shell.interaction.DungeonHitCollector;
import features.world.dungeonmap.state.DungeonMapState;
import features.world.dungeonmap.state.DungeonRuntimeState;
import features.world.dungeonmap.state.DungeonViewMode;
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
    private DungeonRuntimeDescriptionRef lastPublishedDescriptionRef;

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
        DungeonRuntimeDescription description = resolveRuntimeDescription();
        workspace().showRuntimeRenderOverlay(DungeonRuntimeRenderOverlay.from(runtimeState.activeNavigation(), description));
        refreshTravelPane(description);
        publishRuntimeDetails(description);
        refreshLabels();
    }

    private void refreshRuntimeState() {
        if (state().busy()) {
            runtimeState.showLoading();
            return;
        }
        if (state().activeMap().mapId() <= 0) {
            runtimeMapId = null;
            lastPublishedDescriptionRef = null;
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
            lastPublishedDescriptionRef = null;
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
                    System.err.println("DungeonRuntimeView.loadRuntimeNavigation(): " + failure.getMessage());
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
                    System.err.println("DungeonRuntimeView.movePartyToNavigation(): " + failure.getMessage());
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

    private void refreshTravelPane(DungeonRuntimeDescription description) {
        if (travelSurface == null) {
            return;
        }
        DungeonRuntimeNavigationSnapshot navigation = runtimeState.activeNavigation();
        travelSurface.showDungeonTravel(new WorldTravelSurface.DungeonTravelPresentation(
                state().activeMap().name(),
                description == null ? "Kein Standort" : description.title(),
                cellLabel(navigation.cell(), navigation.levelZ()),
                headingLabel(navigation.heading()),
                runtimeStatusText(),
                travelActions(description),
                workspace()::resetView));
    }

    private List<WorldTravelSurface.DungeonTravelAction> travelActions(DungeonRuntimeDescription description) {
        if (description == null) {
            return List.of();
        }
        return description.availableActions().stream()
                .map(this::toTravelAction)
                .toList();
    }

    private WorldTravelSurface.DungeonTravelAction toTravelAction(DungeonRuntimeAction action) {
        return new WorldTravelSurface.DungeonTravelAction(action.label(), () -> triggerRuntimeAction(action));
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
                    System.err.println("DungeonRuntimeView.triggerRuntimeAction(): " + failure.getMessage());
                    runtimeState.showFailure(action.failureMessage());
                });
    }

    private void applyNavigationSnapshot(DungeonRuntimeNavigationSnapshot snapshot) {
        if (snapshot != null && snapshot.mapId() != null && !Objects.equals(snapshot.mapId(), state().activeMapId())) {
            runtimeState.showPendingNavigation(snapshot);
            loadingService().selectMap(snapshot.mapId());
            return;
        }
        runtimeState.showNavigation(snapshot);
        if (snapshot != null && snapshot.cell() != null) {
            state().setReachableProjectionLevel(snapshot.levelZ());
        }
    }

    private void publishRuntimeDetails(DungeonRuntimeDescription description) {
        if (runtimeState.loading() || runtimeState.moving() || runtimeState.dragging()) {
            return;
        }
        if (description == null || description.ref() == null) {
            return;
        }
        DetailsNavigator.EntryKey entryKey = new DetailsNavigator.EntryKey("dungeon-runtime", description.ref());
        boolean refreshCurrentCard = detailsNavigator.isShowing(entryKey);
        if (!refreshCurrentCard && Objects.equals(lastPublishedDescriptionRef, description.ref())) {
            return;
        }
        lastPublishedDescriptionRef = description.ref();
        detailsNavigator.showContent(description.title(), entryKey, () -> new DungeonRuntimeDescriptionPane(
                description,
                this::triggerRuntimeAction));
    }

    private DungeonRuntimeDescription resolveRuntimeDescription() {
        DungeonRuntimeNavigationSnapshot navigation = runtimeState.activeNavigation();
        var layout = state().activeMap();
        if (layout == null || navigation == null || navigation.isEmpty()) {
            return null;
        }
        return DungeonRuntimeDescriptionResolver.resolve(layout, navigation);
    }

    private static Label sectionLabel(String text) {
        Label label = new Label(text);
        label.getStyleClass().addAll("section-header", "text-muted");
        return label;
    }

    private static String cellLabel(CellCoord cell, int levelZ) {
        return cell == null ? "—" : cell.x() + ", " + cell.y() + ", z=" + levelZ;
    }

    private static String headingLabel(CardinalDirection heading) {
        CardinalDirection resolvedHeading = heading == null ? CardinalDirection.defaultDirection() : heading;
        return resolvedHeading.label();
    }
}
