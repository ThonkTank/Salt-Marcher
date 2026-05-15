package src.domain.dungeon.model.editor.usecase;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import src.domain.dungeon.model.editor.helper.DungeonEditorBoundaryClusterResolutionHelper;
import src.domain.dungeon.model.editor.helper.DungeonEditorBoundaryGraphHelper;
import src.domain.dungeon.model.editor.helper.DungeonEditorBoundaryRoomTouchHelper;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorInteractionValues.VertexKey;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorMainViewEffect;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorMainViewInteractionValues.BoundaryDraft;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorMainViewInteractionValues.BoundaryTarget;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorMainViewInteractionValues.EdgeKey;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorMainViewInteractionValues.InteractionState;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorMainViewInterpretation;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorMainViewInteractionValues.PathResult;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorMainViewInteractionValues.PointerState;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionValues;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues;

final class DungeonEditorBoundaryDraftUseCase {
    private final DungeonEditorBoundaryClusterResolutionHelper clusterResolver = new DungeonEditorBoundaryClusterResolutionHelper();
    private final DungeonEditorBoundaryGraphHelper graphService = new DungeonEditorBoundaryGraphHelper();
    private final DungeonEditorBoundaryRoomTouchHelper roomTouchService = new DungeonEditorBoundaryRoomTouchHelper();

    DungeonEditorMainViewInterpretation press(
            PointerState input,
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            DungeonEditorSessionValues.Selection currentSelection,
            DungeonEditorSessionValues.Tool selectedTool,
            InteractionState state
    ) {
        if (selectedTool.isDoorTool()) {
            return new DungeonEditorMainViewInterpretation(state, applyDoorBoundaryPress(input, snapshot, selectedTool));
        }
        var vertex = input.vertexTarget();
        if (!vertexPresent(vertex)) {
            return clearedBoundaryDraft(state);
        }
        boolean deleteMode = selectedTool.deleteMode();
        long clusterId = clusterResolver.resolveClusterId(input, vertex, deleteMode, snapshot, currentSelection, graphService);
        if (!DungeonEditorWorkspaceValues.hasId(clusterId)) {
            return clearedBoundaryDraft(state);
        }
        VertexKey nextVertex = new VertexKey(vertex.q(), vertex.r(), vertex.level());
        if (!state.boundaryDraft().present() || state.boundaryDraft().clusterId() != clusterId) {
            return beginBoundaryDraft(snapshot, clusterId, vertex, deleteMode, nextVertex, state);
        }
        if (state.boundaryDraft().currentVertex().equals(nextVertex)) {
            return new DungeonEditorMainViewInterpretation(state, preview(input, snapshot, selectedTool, state));
        }
        return advanceBoundaryDraft(input, snapshot, selectedTool, clusterId, deleteMode, nextVertex, state);
    }

    DungeonEditorMainViewEffect preview(
            PointerState input,
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            DungeonEditorSessionValues.Tool selectedTool,
            InteractionState state
    ) {
        if (selectedTool.isDoorTool()) {
            BoundaryTarget boundary = input.boundaryTarget();
            boolean deleteMode = selectedTool.deleteMode();
            if (!roomTouchService.editableDoorBoundary(snapshot, boundary, deleteMode)) {
                return DungeonEditorMainViewEffect.clearPreviewIfNeeded(true);
            }
            long clusterId = clusterResolver.resolveBoundaryClusterId(snapshot, boundary);
            return DungeonEditorMainViewEffect.preview(new DungeonEditorSessionValues.ClusterBoundariesPreview(
                    clusterId,
                    List.of(boundary.edgeRef()),
                    DungeonEditorWorkspaceValues.BoundaryKind.DOOR,
                    deleteMode));
        }
        if (!state.boundaryDraft().present()) {
            return DungeonEditorMainViewEffect.clearPreviewIfNeeded(false);
        }
        Set<EdgeKey> previewEdges = new LinkedHashSet<>(state.boundaryDraft().previewEdges());
        PathResult candidate = graphService.previewCandidate(input, snapshot, state.boundaryDraft(), selectedTool.deleteMode());
        previewEdges.addAll(candidate.committedEdges());
        if (previewEdges.isEmpty()) {
            return DungeonEditorMainViewEffect.clearPreviewIfNeeded(true);
        }
        return DungeonEditorMainViewEffect.preview(new DungeonEditorSessionValues.ClusterBoundariesPreview(
                state.boundaryDraft().clusterId(),
                previewEdges.stream().map(EdgeKey::toEdgeRef).toList(),
                DungeonEditorWorkspaceValues.BoundaryKind.WALL,
                state.boundaryDraft().deleteMode()));
    }

    private DungeonEditorMainViewEffect applyDoorBoundaryPress(
            PointerState input,
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            DungeonEditorSessionValues.Tool selectedTool
    ) {
        if (!input.primaryButtonDown()) {
            return DungeonEditorMainViewEffect.none();
        }
        BoundaryTarget boundary = input.boundaryTarget();
        boolean deleteMode = selectedTool.deleteMode();
        if (!roomTouchService.editableDoorBoundary(snapshot, boundary, deleteMode)) {
            return DungeonEditorMainViewEffect.none();
        }
        return DungeonEditorMainViewEffect.apply(new DungeonEditorSessionValues.ClusterBoundariesPreview(
                clusterResolver.resolveBoundaryClusterId(snapshot, boundary),
                List.of(boundary.edgeRef()),
                DungeonEditorWorkspaceValues.BoundaryKind.DOOR,
                deleteMode));
    }

    private DungeonEditorMainViewInterpretation beginBoundaryDraft(
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            long clusterId,
            src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorInteractionValues.VertexTarget vertex,
            boolean deleteMode,
            VertexKey nextVertex,
            InteractionState state
    ) {
        if (!graphService.isEditableVertex(snapshot, clusterId, vertex, deleteMode)) {
            return new DungeonEditorMainViewInterpretation(state, DungeonEditorMainViewEffect.none());
        }
        InteractionState nextState = state.withBoundaryDraft(
                new BoundaryDraft(clusterId, deleteMode, nextVertex, nextVertex, Set.of(), true));
        return new DungeonEditorMainViewInterpretation(nextState, DungeonEditorMainViewEffect.clearPreviewIfNeeded(true));
    }

    private DungeonEditorMainViewInterpretation advanceBoundaryDraft(
            PointerState input,
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            DungeonEditorSessionValues.Tool selectedTool,
            long clusterId,
            boolean deleteMode,
            VertexKey nextVertex,
            InteractionState state
    ) {
        PathResult path = deleteMode
                ? graphService.findDeletePath(snapshot, clusterId, state.boundaryDraft().currentVertex(), nextVertex)
                : graphService.findCreatePath(snapshot, clusterId, state.boundaryDraft().currentVertex(), nextVertex);
        if (!path.hasRoute()) {
            return new DungeonEditorMainViewInterpretation(state, DungeonEditorMainViewEffect.clearPreviewIfNeeded(true));
        }
        Set<EdgeKey> previewEdges = new LinkedHashSet<>(state.boundaryDraft().previewEdges());
        previewEdges.addAll(path.committedEdges());
        InteractionState nextState = state.withBoundaryDraft(new BoundaryDraft(
                clusterId,
                deleteMode,
                state.boundaryDraft().startVertex(),
                nextVertex,
                previewEdges,
                true));
        return applyBoundaryDraftOrPreview(input, snapshot, selectedTool, nextVertex, nextState);
    }

    private DungeonEditorMainViewInterpretation applyBoundaryDraftOrPreview(
            PointerState input,
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            DungeonEditorSessionValues.Tool selectedTool,
            VertexKey nextVertex,
            InteractionState state
    ) {
        if (!state.boundaryDraft().deleteMode()
                && graphService.touchesExistingWall(snapshot, state.boundaryDraft().clusterId(), nextVertex)) {
            BoundaryDraft current = state.boundaryDraft();
            InteractionState nextState = state.withBoundaryDraft(BoundaryDraft.none());
            if (current.previewEdges().isEmpty()) {
                return new DungeonEditorMainViewInterpretation(nextState, DungeonEditorMainViewEffect.clearPreviewIfNeeded(true));
            }
            return new DungeonEditorMainViewInterpretation(
                    nextState,
                    DungeonEditorMainViewEffect.apply(new DungeonEditorSessionValues.ClusterBoundariesPreview(
                            current.clusterId(),
                            current.previewEdges().stream().map(EdgeKey::toEdgeRef).toList(),
                            DungeonEditorWorkspaceValues.BoundaryKind.WALL,
                            current.deleteMode())));
        }
        return new DungeonEditorMainViewInterpretation(state, preview(input, snapshot, selectedTool, state));
    }

    private static DungeonEditorMainViewInterpretation clearedBoundaryDraft(InteractionState state) {
        return new DungeonEditorMainViewInterpretation(
                state.boundaryDraft().present() ? state : state.clear(),
                DungeonEditorMainViewEffect.none());
    }

    private static boolean vertexPresent(
            src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorInteractionValues.VertexTarget vertex
    ) {
        return vertex != null && vertex.present();
    }
}
