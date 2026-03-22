package features.world.dungeonmap.shell.editor;

import features.world.dungeonmap.application.corridor.DungeonCorridorEditService;
import features.world.dungeonmap.application.room.DungeonClusterMoveService;
import features.world.dungeonmap.application.room.DungeonRoomEditService;
import features.world.dungeonmap.canvas.base.DungeonCanvasWorkspace;
import features.world.dungeonmap.catalog.application.DungeonMapCatalogService;
import features.world.dungeonmap.loading.DungeonMapCatalogEntry;
import features.world.dungeonmap.loading.DungeonMapLoadingService;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.shell.editor.interaction.CorridorInteractionController;
import features.world.dungeonmap.shell.editor.interaction.ClusterSelectionDragController;
import features.world.dungeonmap.shell.editor.interaction.DungeonEditorGridInteractionController;
import features.world.dungeonmap.shell.editor.interaction.RoomPaintInteractionController;
import features.world.dungeonmap.state.DungeonCorridorDraftState;
import features.world.dungeonmap.state.EditorLayoutPreviewState;
import features.world.dungeonmap.state.EditorPaintPreviewState;
import features.world.dungeonmap.state.EditorSelectionState;
import features.world.dungeonmap.state.DungeonEditorSessionState;
import features.world.dungeonmap.state.DungeonMapState;

import java.util.Objects;

final class DungeonEditorCoordinator {

    private final DungeonEditorControls controls;
    private final DungeonEditorStatePane statePane;
    private final DungeonCanvasWorkspace workspace;
    private final DungeonMapLoadingService loadingService;
    private final DungeonMapState mapState;
    private final DungeonEditorSessionState sessionState;
    private final DungeonMapDropdownController mapDropdownController;
    private final EditorSelectionState selectionState = new EditorSelectionState();
    private final EditorLayoutPreviewState layoutPreviewState = new EditorLayoutPreviewState();
    private final EditorPaintPreviewState paintPreviewState = new EditorPaintPreviewState();
    private final DungeonCorridorDraftState corridorDraftState = new DungeonCorridorDraftState();
    private final DungeonEditorGridInteractionController interactionController;

    DungeonEditorCoordinator(
            DungeonEditorControls controls,
            DungeonEditorStatePane statePane,
            DungeonCanvasWorkspace workspace,
            DungeonMapLoadingService loadingService,
            DungeonMapState mapState,
            DungeonEditorSessionState sessionState,
            DungeonMapCatalogService mapCatalogService,
            DungeonRoomEditService roomEditService,
            DungeonClusterMoveService clusterMoveService,
            DungeonCorridorEditService corridorEditService
    ) {
        this.controls = Objects.requireNonNull(controls, "controls");
        this.statePane = Objects.requireNonNull(statePane, "statePane");
        this.workspace = Objects.requireNonNull(workspace, "workspace");
        this.loadingService = Objects.requireNonNull(loadingService, "loadingService");
        this.mapState = Objects.requireNonNull(mapState, "mapState");
        this.sessionState = Objects.requireNonNull(sessionState, "sessionState");
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
                Objects.requireNonNull(roomEditService, "roomEditService"));
        CorridorInteractionController corridorInteractionController = new CorridorInteractionController(
                mapState,
                loadingService,
                sessionState,
                selectionState,
                corridorDraftState,
                Objects.requireNonNull(corridorEditService, "corridorEditService"));
        this.interactionController = new DungeonEditorGridInteractionController(
                mapState,
                sessionState,
                clusterSelectionDragController,
                roomPaintInteractionController,
                corridorInteractionController);
        this.mapDropdownController = new DungeonMapDropdownController(
                Objects.requireNonNull(mapCatalogService, "mapCatalogService"),
                new MapReloadHandle());
        installBindings();
        sessionState.addListener(this::refreshFromSessionState);
        selectionState.addListener(this::refreshSelectionState);
        selectionState.addListener(this::refreshCorridorStatePane);
        layoutPreviewState.addListener(this::refreshLayoutPreviewState);
        paintPreviewState.addListener(this::refreshPaintPreviewState);
        corridorDraftState.addListener(this::refreshCorridorStatePane);
        refreshFromSessionState();
        refreshSelectionState();
        refreshLayoutPreviewState();
        refreshPaintPreviewState();
        refreshCorridorStatePane();
    }

    void refreshFromMapState() {
        controls.showMaps(mapState.maps(), mapState.activeMapId(), mapState.loading());
        refreshFromSessionState();
    }

    private void installBindings() {
        controls.setOnMapSelected(this::loadSelectedMap);
        controls.setOnNewMapRequested(mapDropdownController::showCreate);
        controls.setOnEditMapRequested(request ->
                mapDropdownController.showEdit(new DungeonMapDropdownController.EditRequest(request.map(), request.anchor())));
        controls.setOnViewModeChanged(sessionState::selectViewMode);
        controls.setOnToolChanged(sessionState::selectTool);
        workspace.setInteractionHandler(interactionController);
    }

    private void refreshFromSessionState() {
        controls.selectViewMode(sessionState.viewMode());
        controls.showDisplayedTool(sessionState.selectedTool());
        workspace.setViewMode(sessionState.viewMode());
        if (sessionState.selectedTool() != DungeonEditorTool.SELECT || sessionState.viewMode() != features.world.dungeonmap.canvas.base.DungeonViewMode.GRID) {
            interactionController.clear();
        }
        statePane.refresh(sessionState.selectedTool());
        refreshCorridorStatePane();
    }

    private void refreshSelectionState() {
        workspace.setSelectedTargetKey(selectionState.selectedTargetKey());
    }

    private void refreshLayoutPreviewState() {
        workspace.setPreviewMapModel(layoutPreviewState.previewMap());
    }

    private void refreshPaintPreviewState() {
        workspace.setPreviewPaintShape(paintPreviewState.previewShape(), paintPreviewState.deleteMode());
    }

    private void refreshCorridorStatePane() {
        if (corridorDraftState.hasPendingStart()) {
            statePane.showCorridorStatus("Start gewählt, Zielraum anklicken");
            return;
        }
        String selectedTargetKey = selectionState.selectedTargetKey();
        if (Corridor.isTargetKey(selectedTargetKey)) {
            statePane.showCorridorStatus("Gewählt: " + selectedTargetKey.replace(Corridor.targetKeyPrefix(), "Korridor "));
            return;
        }
        statePane.showCorridorStatus(null);
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
