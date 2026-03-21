package features.world.dungeonmap.shell.editor;

import features.world.dungeonmap.application.room.DungeonRoomEditService;
import features.world.dungeonmap.canvas.base.DungeonCanvasWorkspace;
import features.world.dungeonmap.catalog.application.DungeonMapCatalogService;
import features.world.dungeonmap.loading.DungeonMapCatalogEntry;
import features.world.dungeonmap.loading.DungeonMapLoadingService;
import features.world.dungeonmap.shell.editor.interaction.ClusterSelectionDragController;
import features.world.dungeonmap.shell.editor.interaction.DungeonEditorGridInteractionController;
import features.world.dungeonmap.shell.editor.interaction.RoomPaintInteractionController;
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
    private final DungeonEditorGridInteractionController interactionController;

    DungeonEditorCoordinator(
            DungeonEditorControls controls,
            DungeonEditorStatePane statePane,
            DungeonCanvasWorkspace workspace,
            DungeonMapLoadingService loadingService,
            DungeonMapState mapState,
            DungeonEditorSessionState sessionState,
            DungeonMapCatalogService mapCatalogService,
            DungeonRoomEditService roomEditService
    ) {
        this.controls = Objects.requireNonNull(controls, "controls");
        this.statePane = Objects.requireNonNull(statePane, "statePane");
        this.workspace = Objects.requireNonNull(workspace, "workspace");
        this.loadingService = Objects.requireNonNull(loadingService, "loadingService");
        this.mapState = Objects.requireNonNull(mapState, "mapState");
        this.sessionState = Objects.requireNonNull(sessionState, "sessionState");
        ClusterSelectionDragController clusterSelectionDragController = new ClusterSelectionDragController(
                mapState,
                selectionState,
                layoutPreviewState);
        RoomPaintInteractionController roomPaintInteractionController = new RoomPaintInteractionController(
                mapState,
                loadingService,
                sessionState,
                selectionState,
                paintPreviewState,
                Objects.requireNonNull(roomEditService, "roomEditService"));
        this.interactionController = new DungeonEditorGridInteractionController(
                mapState,
                sessionState,
                clusterSelectionDragController,
                roomPaintInteractionController);
        this.mapDropdownController = new DungeonMapDropdownController(
                Objects.requireNonNull(mapCatalogService, "mapCatalogService"),
                new MapReloadHandle());
        installBindings();
        sessionState.addListener(this::refreshFromSessionState);
        selectionState.addListener(this::refreshFromInteractionState);
        layoutPreviewState.addListener(this::refreshFromInteractionState);
        paintPreviewState.addListener(this::refreshFromInteractionState);
        refreshFromSessionState();
        refreshFromInteractionState();
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
    }

    private void refreshFromInteractionState() {
        workspace.setSelectedTargetKey(selectionState.selectedTargetKey());
        workspace.setPreviewMapModel(layoutPreviewState.previewMap());
        workspace.setPreviewPaintShape(paintPreviewState.previewShape(), paintPreviewState.deleteMode());
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
