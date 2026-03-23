package features.world.dungeonmap.shell.editor;

import features.world.dungeonmap.application.corridor.DungeonCorridorEditService;
import features.world.dungeonmap.application.stair.DungeonStairEditService;
import features.world.dungeonmap.application.room.DungeonBoundaryEditService;
import features.world.dungeonmap.application.room.DungeonClusterMoveService;
import features.world.dungeonmap.application.room.DungeonRoomNarrationService;
import features.world.dungeonmap.application.room.DungeonRoomTopologyService;
import features.world.dungeonmap.application.room.RoomExitCatalog;
import features.world.dungeonmap.canvas.base.DungeonCanvasWorkspace;
import features.world.dungeonmap.catalog.application.DungeonMapCatalogService;
import features.world.dungeonmap.loading.DungeonMapCatalogEntry;
import features.world.dungeonmap.loading.DungeonMapLoadingService;
import features.world.dungeonmap.model.structures.cluster.RoomCluster;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.model.structures.room.RoomNarration;
import features.world.dungeonmap.model.structures.stair.DungeonStair;
import features.world.dungeonmap.shell.editor.interaction.CorridorInteractionController;
import features.world.dungeonmap.shell.editor.interaction.BoundaryInteractionController;
import features.world.dungeonmap.shell.editor.interaction.ClusterSelectionDragController;
import features.world.dungeonmap.shell.editor.interaction.DungeonEditorGridInteractionController;
import features.world.dungeonmap.shell.editor.interaction.RoomPaintInteractionController;
import features.world.dungeonmap.shell.editor.interaction.StairInteractionController;
import features.world.dungeonmap.state.DungeonCorridorDraftState;
import features.world.dungeonmap.state.EditorLayoutPreviewState;
import features.world.dungeonmap.state.EditorPaintPreviewState;
import features.world.dungeonmap.state.EditorSelectionState;
import features.world.dungeonmap.state.DungeonEditorSessionState;
import features.world.dungeonmap.state.DungeonMapState;
import features.world.dungeonmap.state.DungeonStairDraftState;
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
    private final EditorSelectionState selectionState = new EditorSelectionState();
    private final EditorLayoutPreviewState layoutPreviewState = new EditorLayoutPreviewState();
    private final EditorPaintPreviewState paintPreviewState = new EditorPaintPreviewState();
    private final DungeonCorridorDraftState corridorDraftState = new DungeonCorridorDraftState();
    private final DungeonStairDraftState stairDraftState = new DungeonStairDraftState();
    private final DungeonStairEditService stairEditService;
    private final StairInteractionController stairInteractionController;
    private final DungeonEditorGridInteractionController interactionController;
    private DungeonEditorTool previousTool = DungeonEditorTool.SELECT;
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
            DungeonStairEditService stairEditService
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
                Objects.requireNonNull(boundaryEditService, "boundaryEditService"));
        this.stairInteractionController = new StairInteractionController(
                mapState,
                loadingService,
                sessionState,
                selectionState,
                stairDraftState,
                this.stairEditService);
        this.interactionController = new DungeonEditorGridInteractionController(
                mapState,
                sessionState,
                clusterSelectionDragController,
                roomPaintInteractionController,
                corridorInteractionController,
                boundaryInteractionController,
                this.stairInteractionController);
        this.mapDropdownController = new DungeonMapDropdownController(
                Objects.requireNonNull(mapCatalogService, "mapCatalogService"),
                new MapReloadHandle());
        installBindings();
        sessionState.addListener(this::refreshFromSessionState);
        selectionState.addListener(this::refreshSelectionState);
        selectionState.addListener(this::refreshCorridorStatePane);
        selectionState.addListener(this::refreshStairStatePane);
        selectionState.addListener(this::refreshRoomNarrationStatePane);
        layoutPreviewState.addListener(this::refreshLayoutPreviewState);
        paintPreviewState.addListener(this::refreshPaintPreviewState);
        corridorDraftState.addListener(this::refreshCorridorStatePane);
        stairDraftState.addListener(this::refreshStairStatePane);
        refreshFromSessionState();
        refreshSelectionState();
        refreshLayoutPreviewState();
        refreshPaintPreviewState();
        refreshCorridorStatePane();
        refreshStairStatePane();
        workspace.setPreviewStairPath(List.of());
        refreshRoomNarrationStatePane();
    }

    void refreshFromMapState() {
        boolean mapChanged = !Objects.equals(previousMapId, mapState.activeMapId());
        controls.showMaps(mapState.maps(), mapState.activeMapId(), mapState.loading());
        controls.showLevels(
                mapState.activeMap().reachableLevels(),
                mapState.activeProjectionLevel(),
                mapState.loading(),
                mapState.activeMapId() != null);
        workspace.setProjectionLevel(mapState.activeProjectionLevel());
        if (mapChanged && sessionState.selectedTool() == DungeonEditorTool.STAIR_CREATE) {
            stairDraftState.resetForLevel(mapState.activeProjectionLevel());
        }
        refreshFromSessionState();
        workspace.setPreviewStairPath(List.of());
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
        controls.setOnViewModeChanged(sessionState::selectViewMode);
        controls.setOnToolChanged(sessionState::selectTool);
        statePane.setOnStairInputLevelChanged(stairDraftState::setInputLevel);
        statePane.setOnStairLevelDecrementRequested(() -> stairDraftState.adjustInputLevel(-1));
        statePane.setOnStairLevelIncrementRequested(() -> stairDraftState.adjustInputLevel(1));
        statePane.setOnStairAddRequested(stairDraftState::addExitLevel);
        statePane.setOnStairExitRemoveRequested(stairDraftState::removeExitLevel);
        workspace.setInteractionHandler(interactionController);
    }

    private void refreshFromSessionState() {
        DungeonEditorTool selectedTool = sessionState.selectedTool();
        boolean enteringStairCreate = selectedTool == DungeonEditorTool.STAIR_CREATE
                && previousTool != DungeonEditorTool.STAIR_CREATE;
        controls.selectViewMode(sessionState.viewMode());
        controls.showDisplayedTool(selectedTool);
        workspace.setViewMode(sessionState.viewMode());
        if (selectedTool != DungeonEditorTool.SELECT || sessionState.viewMode() != features.world.dungeonmap.canvas.base.DungeonViewMode.GRID) {
            interactionController.clear();
        }
        if (enteringStairCreate) {
            stairDraftState.resetForLevel(mapState.activeProjectionLevel());
        }
        statePane.refresh(selectedTool);
        refreshCorridorStatePane();
        refreshStairStatePane();
        previousTool = selectedTool;
    }

    private void refreshLayoutPreviewState() {
        workspace.setPreviewMapModel(layoutPreviewState.previewMap());
    }

    private void refreshPaintPreviewState() {
        workspace.setPreviewPaintShape(paintPreviewState.previewShape(), paintPreviewState.deleteMode());
    }

    private void refreshSelectionState() {
        workspace.setSelectedTargetKey(selectionState.selectedTargetKey());
    }

    private void refreshCorridorStatePane() {
        if (corridorDraftState.hasPendingStart()) {
            statePane.showCorridorStatus("Start gewählt, Zielraum anklicken");
            return;
        }
        String selectedTargetKey = selectionState.selectedTargetKey();
        if (Corridor.isTargetKey(selectedTargetKey)) {
            statePane.showCorridorStatus("Gewählt: " + DungeonEditorSelectionLabels.corridorLabel(selectedTargetKey));
            return;
        }
        statePane.showCorridorStatus(null);
    }

    private void refreshStairStatePane() {
        if (sessionState.selectedTool() != DungeonEditorTool.STAIR_CREATE
                && sessionState.selectedTool() != DungeonEditorTool.STAIR_DELETE
                && !DungeonStair.isTargetKey(selectionState.selectedTargetKey())) {
            statePane.showStairDraft(null);
            return;
        }
        if (sessionState.selectedTool() == DungeonEditorTool.STAIR_DELETE) {
            String selectedTargetKey = selectionState.selectedTargetKey();
            String summary = DungeonStair.isTargetKey(selectedTargetKey)
                    ? "Gewählt: " + DungeonEditorSelectionLabels.stairLabel(selectedTargetKey)
                    : "Treppenfeld anklicken, um zu löschen";
            statePane.showStairDraft(
                    new DungeonEditorStatePane.StairDraftCard(null, List.of(), summary, false));
            return;
        }
        statePane.showStairDraft(
                new DungeonEditorStatePane.StairDraftCard(
                        stairDraftState.inputLevel(),
                        stairDraftState.exitLevels(),
                        stairDraftState.statusMessage(),
                        true));
    }

    private void refreshRoomNarrationStatePane() {
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
                RoomExitCatalog.describe(room).stream()
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
