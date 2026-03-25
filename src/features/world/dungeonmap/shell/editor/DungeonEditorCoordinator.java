package features.world.dungeonmap.shell.editor;

import features.world.dungeonmap.application.corridor.DungeonCorridorEditService;
import features.world.dungeonmap.application.stair.DungeonStairEditService;
import features.world.dungeonmap.application.transition.DungeonTransitionEditService;
import features.world.dungeonmap.application.transition.DungeonTransitionTargetCatalogService;
import features.world.dungeonmap.application.room.DungeonBoundaryEditService;
import features.world.dungeonmap.application.room.DungeonClusterMoveService;
import features.world.dungeonmap.application.room.DungeonRoomNarrationService;
import features.world.dungeonmap.application.room.DungeonRoomTopologyService;
import features.world.dungeonmap.application.room.RoomExitCatalog;
import features.world.dungeonmap.canvas.base.DungeonCanvasWorkspace;
import features.world.dungeonmap.canvas.base.DungeonViewMode;
import features.world.dungeonmap.catalog.application.DungeonMapCatalogService;
import features.world.dungeonmap.loading.DungeonMapCatalogEntry;
import features.world.dungeonmap.loading.DungeonMapLoadingService;
import features.world.dungeonmap.model.structures.cluster.RoomCluster;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.model.structures.room.RoomNarration;
import features.world.dungeonmap.shell.editor.interaction.CorridorInteractionController;
import features.world.dungeonmap.shell.editor.interaction.BoundaryInteractionController;
import features.world.dungeonmap.shell.editor.interaction.ClusterSelectionDragController;
import features.world.dungeonmap.shell.editor.interaction.DungeonEditorGridInteractionController;
import features.world.dungeonmap.shell.editor.interaction.EditorToolHandler;
import features.world.dungeonmap.shell.editor.interaction.RoomPaintToolHandler;
import features.world.dungeonmap.shell.editor.interaction.SelectionToolHandler;
import features.world.dungeonmap.shell.editor.interaction.CorridorToolHandler;
import features.world.dungeonmap.shell.editor.interaction.BoundaryToolHandler;
import features.world.dungeonmap.shell.editor.interaction.RoomPaintInteractionController;
import features.world.dungeonmap.shell.editor.interaction.StairToolHandler;
import features.world.dungeonmap.shell.editor.interaction.StairInteractionController;
import features.world.dungeonmap.shell.editor.interaction.TransitionToolHandler;
import features.world.dungeonmap.shell.editor.interaction.TransitionInteractionController;
import features.world.dungeonmap.state.DungeonCorridorDraftState;
import features.world.dungeonmap.state.DungeonBoundaryDraftState;
import features.world.dungeonmap.state.EditorLayoutPreviewState;
import features.world.dungeonmap.state.EditorPaintPreviewState;
import features.world.dungeonmap.state.EditorSelectionState;
import features.world.dungeonmap.state.DungeonEditorSessionState;
import features.world.dungeonmap.state.DungeonMapState;
import features.world.dungeonmap.state.DungeonStairDraftState;
import features.world.dungeonmap.state.DungeonTransitionDraftState;
import ui.async.UiAsyncTasks;
import ui.async.UiErrorReporter;

import java.util.Comparator;
import java.util.List;
import java.util.Objects;

final class DungeonEditorCoordinator {

    private final DungeonEditorControls controls;
    private final DungeonEditorStatePane statePane;
    private final DungeonCanvasWorkspace workspace;
    private final DungeonMapLoadingService loadingService;
    private final DungeonMapState mapState;
    private final DungeonEditorSessionState sessionState;
    private final DungeonRoomNarrationService roomNarrationService;
    private final DungeonMapDropdownController mapDropdownController;
    private final DungeonTransitionTargetCatalogService transitionTargetCatalogService = new DungeonTransitionTargetCatalogService();
    private final EditorSelectionState selectionState = new EditorSelectionState();
    private final EditorLayoutPreviewState layoutPreviewState = new EditorLayoutPreviewState();
    private final EditorPaintPreviewState paintPreviewState = new EditorPaintPreviewState();
    private final DungeonBoundaryDraftState boundaryDraftState = new DungeonBoundaryDraftState();
    private final DungeonCorridorDraftState corridorDraftState = new DungeonCorridorDraftState();
    private final DungeonStairDraftState stairDraftState = new DungeonStairDraftState();
    private final DungeonTransitionDraftState transitionDraftState = new DungeonTransitionDraftState();
    private final DungeonStairEditService stairEditService;
    private final StairInteractionController stairInteractionController;
    private final TransitionInteractionController transitionInteractionController;
    private final DungeonEditorGridInteractionController interactionController;
    private DungeonEditorTool previousTool;
    private DungeonViewMode previousViewMode;
    private Long previousMapId;

    DungeonEditorCoordinator(
            DungeonEditorControls controls,
            DungeonEditorStatePane statePane,
            DungeonCanvasWorkspace workspace,
            DungeonMapLoadingService loadingService,
            DungeonMapState mapState,
            DungeonEditorSessionState sessionState,
            DungeonMapCatalogService mapCatalogService,
            DungeonRoomTopologyService roomTopologyService,
            DungeonBoundaryEditService boundaryEditService,
            DungeonRoomNarrationService roomNarrationService,
            DungeonClusterMoveService clusterMoveService,
            DungeonCorridorEditService corridorEditService,
            DungeonStairEditService stairEditService,
            DungeonTransitionEditService transitionEditService
    ) {
        this.controls = Objects.requireNonNull(controls, "controls");
        this.statePane = Objects.requireNonNull(statePane, "statePane");
        this.workspace = Objects.requireNonNull(workspace, "workspace");
        this.loadingService = Objects.requireNonNull(loadingService, "loadingService");
        this.mapState = Objects.requireNonNull(mapState, "mapState");
        this.sessionState = Objects.requireNonNull(sessionState, "sessionState");
        this.roomNarrationService = Objects.requireNonNull(roomNarrationService, "roomNarrationService");
        this.stairEditService = Objects.requireNonNull(stairEditService, "stairEditService");
        ClusterSelectionDragController clusterSelectionDragController = new ClusterSelectionDragController(
                mapState,
                loadingService,
                selectionState,
                layoutPreviewState,
                Objects.requireNonNull(clusterMoveService, "clusterMoveService"));
        RoomPaintInteractionController roomPaintInteractionController = new RoomPaintInteractionController(
                mapState,
                loadingService,
                sessionState,
                selectionState,
                paintPreviewState,
                Objects.requireNonNull(roomTopologyService, "roomTopologyService"));
        CorridorInteractionController corridorInteractionController = new CorridorInteractionController(
                mapState,
                loadingService,
                sessionState,
                selectionState,
                corridorDraftState,
                Objects.requireNonNull(corridorEditService, "corridorEditService"));
        BoundaryInteractionController boundaryInteractionController = new BoundaryInteractionController(
                mapState,
                loadingService,
                sessionState,
                selectionState,
                boundaryDraftState,
                Objects.requireNonNull(boundaryEditService, "boundaryEditService"));
        this.stairInteractionController = new StairInteractionController(
                mapState,
                loadingService,
                sessionState,
                selectionState,
                stairDraftState,
                this.stairEditService);
        this.transitionInteractionController = new TransitionInteractionController(
                mapState,
                loadingService,
                sessionState,
                selectionState,
                transitionDraftState,
                Objects.requireNonNull(transitionEditService, "transitionEditService"));
        List<EditorToolHandler> toolHandlers = List.of(
                new SelectionToolHandler(clusterSelectionDragController),
                new RoomPaintToolHandler(roomPaintInteractionController, paintPreviewState),
                new CorridorToolHandler(corridorInteractionController, selectionState, corridorDraftState),
                new BoundaryToolHandler(boundaryInteractionController, boundaryDraftState),
                new StairToolHandler(this.stairInteractionController, mapState, stairDraftState, selectionState),
                new TransitionToolHandler(
                        this.transitionInteractionController,
                        transitionDraftState,
                        transitionTargetCatalogService,
                        mapState,
                        selectionState));
        this.interactionController = new DungeonEditorGridInteractionController(
                mapState,
                sessionState,
                toolHandlers);
        this.mapDropdownController = new DungeonMapDropdownController(
                Objects.requireNonNull(mapCatalogService, "mapCatalogService"),
                new MapReloadHandle());
        installBindings();
        sessionState.addListener(this::refreshFromSessionState);
        selectionState.addListener(this::refreshSelectionState);
        selectionState.addListener(this::refreshRoomNarrationStatePane);
        layoutPreviewState.addListener(this::refreshLayoutPreviewState);
        paintPreviewState.addListener(this::refreshPaintPreviewState);
        boundaryDraftState.addListener(this::refreshBoundaryPreviewState);
        refreshFromSessionState();
        refreshSelectionState();
        refreshLayoutPreviewState();
        refreshPaintPreviewState();
        refreshBoundaryPreviewState();
        refreshRoomNarrationStatePane();
    }

    void refreshFromMapState() {
        boolean mapChanged = !Objects.equals(previousMapId, mapState.activeMapId());
        controls.showMaps(mapState.maps(), mapState.activeMapId(), mapState.loading(), mapState.errorMessage());
        controls.showLevels(
                mapState.activeMap().reachableLevels(),
                mapState.activeProjectionLevel(),
                mapState.loading(),
                mapState.activeMapId() != null);
        controls.showOverlaySettings(mapState.levelOverlaySettings(), mapState.loading());
        workspace.setProjectionLevel(mapState.activeProjectionLevel());
        if (mapChanged) {
            interactionController.activateTool(sessionState.selectedTool());
        }
        refreshFromSessionState();
        refreshRoomNarrationStatePane();
        previousMapId = mapState.activeMapId();
    }

    private void installBindings() {
        controls.setOnMapSelected(this::loadSelectedMap);
        controls.setOnNewMapRequested(mapDropdownController::showCreate);
        controls.setOnEditMapRequested(request ->
                mapDropdownController.showEdit(new DungeonMapDropdownController.EditRequest(request.map(), request.anchor())));
        controls.setOnPreviousLevelRequested(() -> mapState.setActiveProjectionLevel(mapState.activeProjectionLevel() - 1));
        controls.setOnNextLevelRequested(() -> mapState.setActiveProjectionLevel(mapState.activeProjectionLevel() + 1));
        controls.setOnOverlayModeChanged(mapState::setLevelOverlayMode);
        controls.setOnOverlayRangeChanged(mapState::setLevelOverlayRange);
        controls.setOnOverlayOpacityChanged(mapState::setLevelOverlayOpacity);
        controls.setOnSelectedOverlayLevelsChanged(mapState::setSelectedOverlayLevels);
        controls.setOnViewModeChanged(sessionState::selectViewMode);
        controls.setOnToolChanged(sessionState::selectTool);
        workspace.setOnLevelScrollRequested(levelDelta ->
                mapState.setActiveProjectionLevel(mapState.activeProjectionLevel() + levelDelta));
        workspace.setInteractionHandler(interactionController);
    }

    private void refreshFromSessionState() {
        DungeonEditorTool selectedTool = sessionState.selectedTool();
        DungeonViewMode selectedViewMode = sessionState.viewMode();
        boolean sessionChanged = selectedTool != previousTool || selectedViewMode != previousViewMode;
        controls.selectViewMode(sessionState.viewMode());
        controls.showDisplayedTool(selectedTool);
        workspace.setViewMode(selectedViewMode);
        if (sessionChanged) {
            interactionController.activateTool(selectedTool);
        }
        EditorToolHandler handler = interactionController.activeHandler();
        if (handler != null) {
            handler.setRefreshCallback(() ->
                    statePane.refresh(sessionState.selectedTool(), handler.statePaneContent()));
        }
        statePane.refresh(selectedTool, handler == null ? null : handler.statePaneContent());
        previousTool = selectedTool;
        previousViewMode = selectedViewMode;
    }

    private void refreshLayoutPreviewState() {
        workspace.setPreviewMapModel(layoutPreviewState.previewMap());
    }

    private void refreshPaintPreviewState() {
        workspace.setPreviewPaintShape(paintPreviewState.previewShape(), paintPreviewState.deleteMode());
    }

    private void refreshBoundaryPreviewState() {
        DungeonBoundaryDraftState.Draft draft = boundaryDraftState.draft();
        workspace.setPreviewBoundaryEdges(
                draft == null ? java.util.Set.of() : draft.previewEdges(),
                draft == null ? java.util.Set.of() : draft.skippedConnectionEdges(),
                draft == null ? null : draft.startVertex(),
                draft == null ? null : draft.currentVertex(),
                draft != null && draft.deleteMode());
    }

    private void refreshSelectionState() {
        workspace.setSelectedTargetKey(selectionState.selectedTargetKey());
    }

    private void refreshRoomNarrationStatePane() {
        Room selectedRoom = selectedRoom();
        if (selectedRoom != null) {
            statePane.showRoomNarrationEditors(List.of(roomNarrationCard(selectedRoom)), this::saveRoomNarration);
            return;
        }
        RoomCluster cluster = selectedCluster();
        if (cluster == null) {
            statePane.showRoomNarrationEditors(List.of(), this::saveRoomNarration);
            return;
        }
        statePane.showRoomNarrationEditors(cluster.rooms().stream()
                .filter(Objects::nonNull)
                .sorted(Comparator
                        .comparing(Room::name, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER))
                        .thenComparing(Room::roomId, Comparator.nullsLast(Long::compareTo)))
                .map(this::roomNarrationCard)
                .toList(), this::saveRoomNarration);
    }

    private DungeonEditorStatePane.RoomNarrationCard roomNarrationCard(Room room) {
        return new DungeonEditorStatePane.RoomNarrationCard(
                room.roomId() == null ? 0L : room.roomId(),
                room.name(),
                room.narration().visualDescription(),
                RoomExitCatalog.describe(mapState.activeMap(), room).stream()
                        .map(exit -> new DungeonEditorStatePane.RoomExitCard(
                                exit.label(),
                                exit.roomCell(),
                                exit.direction(),
                                room.narration().exitDescription(exit.roomCell(), exit.direction())))
                        .toList());
    }

    private void saveRoomNarration(long roomId, RoomNarration narration) {
        if (roomId <= 0) {
            return;
        }
        statePane.setRoomNarrationSaveState(roomId, true, "Speichert...");
        UiAsyncTasks.submitVoid(
                () -> roomNarrationService.saveNarration(roomId, narration),
                () -> {
                    statePane.setRoomNarrationSaveState(roomId, false, "Gespeichert");
                    loadingService.reload(mapState.activeMapId());
                },
                throwable -> {
                    UiErrorReporter.reportBackgroundFailure("DungeonEditorCoordinator.saveRoomNarration()", throwable);
                    statePane.setRoomNarrationSaveState(roomId, false, "Raumbeschreibung konnte nicht gespeichert werden.");
                });
    }

    private RoomCluster selectedCluster() {
        String targetKey = selectionState.selectedTargetKey();
        if (!RoomCluster.isTargetKey(targetKey)) {
            return null;
        }
        return mapState.activeMap().findCluster(RoomCluster.clusterIdFromKey(targetKey));
    }

    private Room selectedRoom() {
        String targetKey = selectionState.selectedTargetKey();
        if (!Room.isTargetKey(targetKey)) {
            return null;
        }
        return mapState.activeMap().findRoom(Room.roomIdFromKey(targetKey));
    }

    private void loadSelectedMap(DungeonMapCatalogEntry entry) {
        if (entry != null) {
            loadingService.loadMap(entry.mapId());
        }
    }

    private final class MapReloadHandle implements DungeonMapDropdownController.ReloadHandle {
        @Override
        public void reload(Long preferredMapId) {
            loadingService.reload(preferredMapId);
        }

        @Override
        public Long sessionMapId() {
            return mapState.activeMapId();
        }
    }
}
