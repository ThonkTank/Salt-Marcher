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
import features.world.dungeonmap.shell.editor.interaction.BoundaryTool;
import features.world.dungeonmap.shell.editor.interaction.CorridorTool;
import features.world.dungeonmap.shell.editor.interaction.DungeonGridHitTester;
import features.world.dungeonmap.shell.editor.interaction.EditorInteraction;
import features.world.dungeonmap.shell.editor.interaction.EditorTool;
import features.world.dungeonmap.shell.editor.interaction.EditorToolHandler;
import features.world.dungeonmap.shell.editor.interaction.LegacyEditorToolAdapter;
import features.world.dungeonmap.shell.editor.interaction.PaintTool;
import features.world.dungeonmap.shell.editor.interaction.SelectionTool;
import features.world.dungeonmap.shell.editor.interaction.StairTool;
import features.world.dungeonmap.shell.editor.interaction.TransitionToolHandler;
import features.world.dungeonmap.shell.editor.interaction.TransitionInteractionController;
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
    private final EditorInteraction interactionController;
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
        DungeonStairDraftState stairDraftState = new DungeonStairDraftState();
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
                new PaintTool(
                        mapState,
                        loadingService,
                        sessionState,
                        Objects.requireNonNull(roomTopologyService, "roomTopologyService"),
                        interactionState),
                new BoundaryTool(
                        mapState,
                        loadingService,
                        sessionState,
                        Objects.requireNonNull(boundaryEditService, "boundaryEditService"),
                        interactionState),
                new CorridorTool(
                        mapState,
                        loadingService,
                        sessionState,
                        Objects.requireNonNull(corridorEditService, "corridorEditService"),
                        interactionState),
                new StairTool(
                        mapState,
                        loadingService,
                        sessionState,
                        Objects.requireNonNull(stairEditService, "stairEditService"),
                        stairDraftState,
                        interactionState),
                new LegacyEditorToolAdapter(legacyToolHandlers.get(0)));
        this.interactionController = new EditorInteraction(
                mapState,
                sessionState,
                interactionState,
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
        refreshFromSessionState();
        refreshInteractionState();
        refreshSelectionState();
        refreshLayoutPreviewState();
        refreshPaintPreviewState();
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

    private void refreshSelectionState() {
        interactionState.selectTarget(selectionState.selectedTargetKey());
        workspace.setSelectedTargetKey(selectionState.selectedTargetKey());
    }

    private void refreshInteractionState() {
        selectionState.selectTarget(interactionState.selectedTargetKey());
        EditorPreview preview = interactionState.activePreview();
        if (preview instanceof EditorPreview.LayoutPreview layoutPreview) {
            layoutPreviewState.showPreview(layoutPreview.layout());
        } else {
            layoutPreviewState.clearPreview();
        }
        if (preview instanceof EditorPreview.PaintPreview paintPreview) {
            paintPreviewState.showPreview(paintPreview.shape(), paintPreview.deleteMode());
        } else {
            paintPreviewState.clearPreview();
        }
        if (preview instanceof EditorPreview.BoundaryPreview boundaryPreview) {
            workspace.setPreviewBoundaryEdges(
                    boundaryPreview.edges(),
                    boundaryPreview.skippedConnectionEdges(),
                    (features.world.dungeonmap.model.geometry.Point2i) boundaryPreview.startVertex(),
                    (features.world.dungeonmap.model.geometry.Point2i) boundaryPreview.currentVertex(),
                    boundaryPreview.deleteMode());
        } else {
            workspace.setPreviewBoundaryEdges(java.util.Set.of(), java.util.Set.of(), null, null, false);
        }
        refreshToolStatePane();
    }

    private void refreshToolStatePane() {
        Node toolContent = interactionController.activeToolPane();
        statePane.refresh(sessionState.selectedTool(), toolContent);
    }
}
