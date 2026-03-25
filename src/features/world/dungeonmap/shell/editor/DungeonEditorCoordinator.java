package features.world.dungeonmap.shell.editor;

import features.world.dungeonmap.application.corridor.DungeonCorridorEditService;
import features.world.dungeonmap.application.stair.DungeonStairEditService;
import features.world.dungeonmap.application.transition.DungeonTransitionEditService;
import features.world.dungeonmap.application.transition.DungeonTransitionTargetCatalogService;
import features.world.dungeonmap.application.room.DungeonBoundaryEditService;
import features.world.dungeonmap.application.room.DungeonClusterMoveService;
import features.world.dungeonmap.application.room.DungeonRoomNarrationService;
import features.world.dungeonmap.application.room.DungeonRoomTopologyService;
import features.world.dungeonmap.canvas.base.DungeonCanvasWorkspace;
import features.world.dungeonmap.canvas.base.DungeonViewMode;
import features.world.dungeonmap.catalog.application.DungeonMapCatalogService;
import features.world.dungeonmap.loading.DungeonMapLoadingService;
import features.world.dungeonmap.shell.editor.interaction.CorridorInteractionController;
import features.world.dungeonmap.shell.editor.interaction.BoundaryInteractionController;
import features.world.dungeonmap.shell.editor.interaction.DungeonEditorGridInteractionController;
import features.world.dungeonmap.shell.editor.interaction.DungeonGridHitTester;
import features.world.dungeonmap.shell.editor.interaction.EditorTool;
import features.world.dungeonmap.shell.editor.interaction.EditorToolHandler;
import features.world.dungeonmap.shell.editor.interaction.LegacyEditorToolAdapter;
import features.world.dungeonmap.shell.editor.interaction.RoomPaintToolHandler;
import features.world.dungeonmap.shell.editor.interaction.CorridorToolHandler;
import features.world.dungeonmap.shell.editor.interaction.BoundaryToolHandler;
import features.world.dungeonmap.shell.editor.interaction.RoomPaintInteractionController;
import features.world.dungeonmap.shell.editor.interaction.SelectionTool;
import features.world.dungeonmap.shell.editor.interaction.StairToolHandler;
import features.world.dungeonmap.shell.editor.interaction.StairInteractionController;
import features.world.dungeonmap.shell.editor.interaction.TransitionToolHandler;
import features.world.dungeonmap.shell.editor.interaction.TransitionInteractionController;
import features.world.dungeonmap.state.DungeonCorridorDraftState;
import features.world.dungeonmap.state.DungeonBoundaryDraftState;
import features.world.dungeonmap.state.EditorInteractionState;
import features.world.dungeonmap.state.EditorLayoutPreviewState;
import features.world.dungeonmap.state.EditorPreview;
import features.world.dungeonmap.state.EditorPaintPreviewState;
import features.world.dungeonmap.state.EditorSelectionState;
import features.world.dungeonmap.state.DungeonEditorSessionState;
import features.world.dungeonmap.state.DungeonMapState;
import features.world.dungeonmap.state.DungeonStairDraftState;
import features.world.dungeonmap.state.DungeonTransitionDraftState;
import javafx.scene.Node;

import java.util.List;
import java.util.Objects;

final class DungeonEditorCoordinator {

    private final DungeonEditorControls controls;
    private final DungeonEditorStatePane statePane;
    private final DungeonCanvasWorkspace workspace;
    private final DungeonMapLoadingService loadingService;
    private final DungeonMapState mapState;
    private final DungeonEditorSessionState sessionState;
    private final EditorInteractionState interactionState = new EditorInteractionState();
    private final EditorSelectionState selectionState = new EditorSelectionState();
    private final EditorLayoutPreviewState layoutPreviewState = new EditorLayoutPreviewState();
    private final EditorPaintPreviewState paintPreviewState = new EditorPaintPreviewState();
    private final DungeonBoundaryDraftState boundaryDraftState = new DungeonBoundaryDraftState();
    private final DungeonEditorGridInteractionController interactionController;
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
        RoomPaintInteractionController roomPaintInteractionController = new RoomPaintInteractionController(
                mapState,
                loadingService,
                sessionState,
                selectionState,
                paintPreviewState,
                Objects.requireNonNull(roomTopologyService, "roomTopologyService"));
        DungeonCorridorDraftState corridorDraftState = new DungeonCorridorDraftState();
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
        DungeonStairDraftState stairDraftState = new DungeonStairDraftState();
        StairInteractionController stairInteractionController = new StairInteractionController(
                mapState,
                loadingService,
                sessionState,
                selectionState,
                stairDraftState,
                Objects.requireNonNull(stairEditService, "stairEditService"));
        DungeonTransitionDraftState transitionDraftState = new DungeonTransitionDraftState();
        TransitionInteractionController transitionInteractionController = new TransitionInteractionController(
                mapState,
                loadingService,
                sessionState,
                selectionState,
                transitionDraftState,
                Objects.requireNonNull(transitionEditService, "transitionEditService"));
        DungeonTransitionTargetCatalogService transitionTargetCatalogService = new DungeonTransitionTargetCatalogService();
        List<EditorToolHandler> legacyToolHandlers = List.of(
                new RoomPaintToolHandler(roomPaintInteractionController),
                new CorridorToolHandler(corridorInteractionController, selectionState, corridorDraftState),
                new BoundaryToolHandler(boundaryInteractionController, boundaryDraftState),
                new StairToolHandler(stairInteractionController, mapState, stairDraftState, selectionState),
                new TransitionToolHandler(
                        transitionInteractionController,
                        transitionDraftState,
                        transitionTargetCatalogService,
                        mapState,
                        selectionState));
        List<EditorTool> tools = List.of(
                new SelectionTool(
                        mapState,
                        loadingService,
                        Objects.requireNonNull(clusterMoveService, "clusterMoveService"),
                        Objects.requireNonNull(roomNarrationService, "roomNarrationService"),
                        new DungeonGridHitTester(),
                        interactionState),
                new LegacyEditorToolAdapter(legacyToolHandlers.get(0)),
                new LegacyEditorToolAdapter(legacyToolHandlers.get(1)),
                new LegacyEditorToolAdapter(legacyToolHandlers.get(2)),
                new LegacyEditorToolAdapter(legacyToolHandlers.get(3)),
                new LegacyEditorToolAdapter(legacyToolHandlers.get(4)));
        this.interactionController = new DungeonEditorGridInteractionController(
                mapState,
                sessionState,
                tools);
        tools.forEach(tool -> tool.setRefreshCallback(this::refreshToolStatePane));
        DungeonMapDropdownController mapDropdownController = new DungeonMapDropdownController(
                Objects.requireNonNull(mapCatalogService, "mapCatalogService"),
                new DungeonMapDropdownController.ReloadHandle() {
                    @Override
                    public void reload(Long preferredMapId) {
                        loadingService.reload(preferredMapId);
                    }

                    @Override
                    public Long sessionMapId() {
                        return mapState.activeMapId();
                    }
                });
        installBindings(mapDropdownController);
        sessionState.addListener(this::refreshFromSessionState);
        interactionState.addListener(this::refreshInteractionState);
        selectionState.addListener(this::refreshSelectionState);
        layoutPreviewState.addListener(this::refreshLayoutPreviewState);
        paintPreviewState.addListener(this::refreshPaintPreviewState);
        boundaryDraftState.addListener(this::refreshBoundaryPreviewState);
        refreshFromSessionState();
        refreshInteractionState();
        refreshSelectionState();
        refreshLayoutPreviewState();
        refreshPaintPreviewState();
        refreshBoundaryPreviewState();
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
        refreshToolStatePane();
        previousMapId = mapState.activeMapId();
    }

    private void installBindings(DungeonMapDropdownController mapDropdownController) {
        controls.setOnMapSelected(entry -> {
            if (entry != null) {
                loadingService.loadMap(entry.mapId());
            }
        });
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
        controls.selectViewMode(selectedViewMode);
        controls.showDisplayedTool(selectedTool);
        workspace.setViewMode(selectedViewMode);
        interactionController.activateTool(selectedTool);
        refreshToolStatePane();
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

    private void refreshToolStatePane() {
        EditorToolHandler handler = interactionController.activeHandler();
        Node toolContent = handler == null ? null : handler.statePaneContent();
        statePane.refresh(sessionState.selectedTool(), toolContent);
    }
}
