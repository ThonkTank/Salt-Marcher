package features.world.dungeonmap.shell.editor;

import features.world.dungeonmap.canvas.base.DungeonCanvasWorkspace;
import features.world.dungeonmap.canvas.base.DungeonViewMode;
import features.world.dungeonmap.loading.DungeonMapLoadingService;
import features.world.dungeonmap.shell.editor.interaction.EditorInteraction;
import features.world.dungeonmap.state.EditorPreview;
import features.world.dungeonmap.state.DungeonEditorSessionState;
import features.world.dungeonmap.state.DungeonMapState;
import features.world.dungeonmap.model.geometry.Point2i;

import java.util.Objects;
import java.util.Set;

final class DungeonEditorCoordinator {

    private final DungeonEditorControls controls;
    private final DungeonEditorStatePane statePane;
    private final DungeonCanvasWorkspace workspace;
    private final DungeonMapLoadingService loadingService;
    private final DungeonMapState mapState;
    private final DungeonEditorSessionState sessionState;
    private final EditorInteraction editorInteraction;
    private Long previousMapId;

    DungeonEditorCoordinator(
            DungeonEditorControls controls,
            DungeonEditorStatePane statePane,
            DungeonCanvasWorkspace workspace,
            DungeonMapLoadingService loadingService,
            DungeonMapState mapState,
            DungeonEditorSessionState sessionState,
            EditorInteraction editorInteraction
    ) {
        this.controls = Objects.requireNonNull(controls, "controls");
        this.statePane = Objects.requireNonNull(statePane, "statePane");
        this.workspace = Objects.requireNonNull(workspace, "workspace");
        this.loadingService = Objects.requireNonNull(loadingService, "loadingService");
        this.mapState = Objects.requireNonNull(mapState, "mapState");
        this.sessionState = Objects.requireNonNull(sessionState, "sessionState");
        this.editorInteraction = Objects.requireNonNull(editorInteraction, "editorInteraction");
        this.editorInteraction.setOnToolStateChanged(
                () -> statePane.refresh(this.sessionState.selectedTool(), this.editorInteraction.activeToolPane()));
        installBindings();
        this.workspace.setInteractionHandler(editorInteraction);
        sessionState.addListener(this::refreshFromSessionState);
        editorInteraction.state().addListener(this::refreshFromInteractionState);
        refreshFromSessionState();
        refreshFromInteractionState();
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
            editorInteraction.activateTool(sessionState.selectedTool());
        }
        statePane.refresh(sessionState.selectedTool(), editorInteraction.activeToolPane());
        previousMapId = mapState.activeMapId();
    }

    private void installBindings() {
        controls.setOnMapSelected(entry -> {
            if (entry != null) {
                loadingService.loadMap(entry.mapId());
            }
        });
        controls.setOnPreviousLevelRequested(() -> mapState.setActiveProjectionLevel(mapState.activeProjectionLevel() - 1));
        controls.setOnNextLevelRequested(() -> mapState.setActiveProjectionLevel(mapState.activeProjectionLevel() + 1));
        controls.setOnOverlayModeChanged(mapState::setLevelOverlayMode);
        controls.setOnOverlayRangeChanged(mapState::setLevelOverlayRange);
        controls.setOnOverlayOpacityChanged(mapState::setLevelOverlayOpacity);
        controls.setOnSelectedOverlayLevelsChanged(mapState::setSelectedOverlayLevels);
        controls.setOnViewModeChanged(sessionState::selectViewMode);
        controls.setOnToolChanged(sessionState::selectTool);
    }

    private void refreshFromSessionState() {
        DungeonEditorTool selectedTool = sessionState.selectedTool();
        DungeonViewMode selectedViewMode = sessionState.viewMode();
        controls.selectViewMode(selectedViewMode);
        controls.showDisplayedTool(selectedTool);
        workspace.setViewMode(selectedViewMode);
        editorInteraction.activateTool(selectedTool);
        statePane.refresh(selectedTool, editorInteraction.activeToolPane());
    }

    private void refreshFromInteractionState() {
        workspace.setSelectedTargetKey(editorInteraction.state().selectedTargetKey());
        EditorPreview preview = editorInteraction.state().activePreview();
        if (preview instanceof EditorPreview.LayoutPreview layoutPreview) {
            workspace.setPreviewMapModel(layoutPreview.layout());
            workspace.setPreviewPaintShape(null, false);
            workspace.setPreviewBoundaryEdges(Set.of(), Set.of(), null, null, false);
        } else if (preview instanceof EditorPreview.PaintPreview paintPreview) {
            workspace.setPreviewMapModel(null);
            workspace.setPreviewPaintShape(paintPreview.shape(), paintPreview.deleteMode());
            workspace.setPreviewBoundaryEdges(Set.of(), Set.of(), null, null, false);
        } else if (preview instanceof EditorPreview.BoundaryPreview boundaryPreview) {
            workspace.setPreviewMapModel(null);
            workspace.setPreviewPaintShape(null, false);
            workspace.setPreviewBoundaryEdges(
                    boundaryPreview.edges(),
                    boundaryPreview.skippedConnectionEdges(),
                    boundaryPreview.startVertex(),
                    boundaryPreview.currentVertex(),
                    boundaryPreview.deleteMode());
        } else {
            workspace.setPreviewMapModel(null);
            workspace.setPreviewPaintShape(null, false);
            workspace.setPreviewBoundaryEdges(Set.of(), Set.of(), null, null, false);
        }
        statePane.refresh(sessionState.selectedTool(), editorInteraction.activeToolPane());
    }
}
