package src.features.dungeon.runtime;

import java.util.LinkedHashSet;
import java.util.Set;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionEffect;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionValues;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues;
import src.features.dungeon.runtime.DungeonEditorInteractionValues.VertexKey;
import src.features.dungeon.runtime.DungeonEditorInteractionValues.VertexTarget;
import src.features.dungeon.runtime.DungeonEditorMainViewInteractionValues.BoundaryDraft;
import src.features.dungeon.runtime.DungeonEditorMainViewInteractionValues.EdgeKey;
import src.features.dungeon.runtime.DungeonEditorMainViewInteractionValues.InteractionState;
import src.features.dungeon.runtime.DungeonEditorMainViewInteractionValues.PathResult;
import src.features.dungeon.runtime.DungeonEditorMainViewInteractionValues.PointerState;

final class DungeonEditorWallBoundaryDraftUseCase {
    private final DungeonEditorBoundaryClusterUseCase boundaryClusters = new DungeonEditorBoundaryClusterUseCase();
    private final DungeonEditorDirectWallDeleteUseCase directWallDelete = new DungeonEditorDirectWallDeleteUseCase();
    private final DungeonEditorBoundaryVertexUseCase boundaryVertices = new DungeonEditorBoundaryVertexUseCase();
    private final DungeonEditorBoundaryPathUseCase boundaryPaths = new DungeonEditorBoundaryPathUseCase();
    private final DungeonEditorBoundaryDraftEffectHelper draftEffects = new DungeonEditorBoundaryDraftEffectHelper();

    DungeonEditorWallBoundaryDraftInterpretation pressOperation(
            PointerState input,
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            DungeonEditorSessionValues.Selection currentSelection,
            DungeonEditorSessionValues.Tool selectedTool,
            InteractionState state
    ) {
        if (input != null
                && input.secondaryButtonDown()
                && !selectedTool.deleteMode()
                && state.boundaryDraft().present()
                && !state.boundaryDraft().deleteMode()) {
            return completeActiveCreateDraft(input, snapshot, selectedTool, state);
        }
        DungeonEditorMainViewInterpretation directDelete = directWallDelete.press(input, snapshot, selectedTool, state);
        if (directDelete != null) {
            return DungeonEditorWallBoundaryDraftInterpretation.from(directDelete);
        }
        return pressVertexBoundary(input, snapshot, currentSelection, selectedTool, state);
    }

    private DungeonEditorWallBoundaryDraftInterpretation pressVertexBoundary(
            PointerState input,
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            DungeonEditorSessionValues.Selection currentSelection,
            DungeonEditorSessionValues.Tool selectedTool,
            InteractionState state
    ) {
        var vertex = input.vertexTarget();
        if (vertex == null || !vertex.present()) {
            return DungeonEditorWallBoundaryDraftInterpretation.from(
                    draftEffects.preserveActiveDraftOrClearState(state));
        }
        boolean deleteMode = selectedTool.deleteMode();
        long clusterId = boundaryClusters.resolveClusterId(input, vertex, deleteMode, snapshot, currentSelection);
        if (!DungeonEditorWorkspaceValues.hasId(clusterId)) {
            return DungeonEditorWallBoundaryDraftInterpretation.from(
                    draftEffects.preserveActiveDraftOrClearState(state));
        }
        VertexKey nextVertex = new VertexKey(vertex.q(), vertex.r(), vertex.level());
        if (!state.boundaryDraft().present() || state.boundaryDraft().clusterId() != clusterId) {
            return DungeonEditorWallBoundaryDraftInterpretation.from(
                    beginBoundaryDraft(snapshot, clusterId, vertex, deleteMode, nextVertex, state));
        }
        if (state.boundaryDraft().currentVertex().equals(nextVertex)) {
            return DungeonEditorWallBoundaryDraftInterpretation.from(
                    new DungeonEditorMainViewInterpretation(state, preview(input, snapshot, selectedTool, state)));
        }
        return advanceBoundaryDraft(input, snapshot, selectedTool, clusterId, deleteMode, nextVertex, state);
    }

    DungeonEditorSessionEffect preview(
            PointerState input,
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            DungeonEditorSessionValues.Tool selectedTool,
            InteractionState state
    ) {
        if (!state.boundaryDraft().present()) {
            return DungeonEditorSessionEffect.clearPreviewIfNeeded(false);
        }
        Set<EdgeKey> previewEdges = new LinkedHashSet<>(state.boundaryDraft().previewEdges());
        PathResult candidate = boundaryPaths.previewCandidate(
                input,
                snapshot,
                state.boundaryDraft(),
                selectedTool.deleteMode());
        previewEdges.addAll(candidate.committedEdges());
        if (previewEdges.isEmpty()) {
            return DungeonEditorSessionEffect.clearPreviewIfNeeded(true);
        }
        return draftEffects.previewBoundaryEdges(
                state.boundaryDraft().clusterId(),
                previewEdges,
                state.boundaryDraft().deleteMode());
    }

    DungeonEditorWallBoundaryDraftInterpretation releaseOperation(
            PointerState input,
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            DungeonEditorSessionValues.Tool selectedTool,
            InteractionState state
    ) {
        if (state.boundaryDraft().present() && state.boundaryDraft().deleteMode()) {
            return releaseDeleteDraft(input, snapshot, state);
        }
        if (!selectedTool.deleteMode()) {
            if (!state.boundaryDraft().present() || state.boundaryDraft().deleteMode()) {
                return DungeonEditorWallBoundaryDraftInterpretation.from(new DungeonEditorMainViewInterpretation(
                        state,
                        DungeonEditorSessionEffect.clearPreviewIfNeeded(false)));
            }
            if (!input.wallSingleClickMode()) {
                return DungeonEditorWallBoundaryDraftInterpretation.from(
                        new DungeonEditorMainViewInterpretation(state, preview(input, snapshot, selectedTool, state)));
            }
            PathResult candidate = boundaryPaths.previewCandidate(input, snapshot, state.boundaryDraft(), false);
            Set<EdgeKey> committedEdges = state.boundaryDraft().completionCandidate(candidate.committedEdges());
            if (committedEdges.isEmpty()) {
                return DungeonEditorWallBoundaryDraftInterpretation.from(new DungeonEditorMainViewInterpretation(
                        state,
                        DungeonEditorSessionEffect.clearPreviewIfNeeded(true)));
            }
            InteractionState nextState = state.withBoundaryDraft(BoundaryDraft.none());
            return draftEffects.applyWallBoundaryEdges(nextState, state.boundaryDraft().clusterId(), committedEdges, false);
        }
        return releaseDeleteDraft(input, snapshot, state);
    }

    private DungeonEditorWallBoundaryDraftInterpretation releaseDeleteDraft(
            PointerState input,
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            InteractionState state
    ) {
        InteractionState nextState = state.withBoundaryDraft(BoundaryDraft.none());
        if (!state.boundaryDraft().present() || !state.boundaryDraft().deleteMode() || input == null) {
            return DungeonEditorWallBoundaryDraftInterpretation.from(draftEffects.clearBoundaryDraftPreview(nextState));
        }
        PathResult candidate = boundaryPaths.previewCandidate(input, snapshot, state.boundaryDraft(), true);
        Set<EdgeKey> committedEdges = state.boundaryDraft().completionCandidate(candidate.committedEdges());
        if (committedEdges.isEmpty()) {
            return directWallDelete.releaseCorner(input, snapshot, state, nextState);
        }
        return draftEffects.applyWallBoundaryEdges(nextState, state.boundaryDraft().clusterId(), committedEdges, true);
    }

    private DungeonEditorWallBoundaryDraftInterpretation completeActiveCreateDraft(
            PointerState input,
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            DungeonEditorSessionValues.Tool selectedTool,
            InteractionState state
    ) {
        PathResult candidate = boundaryPaths.previewCandidate(input, snapshot, state.boundaryDraft(), false);
        Set<EdgeKey> committedEdges = state.boundaryDraft().completionCandidate(candidate.committedEdges());
        if (committedEdges.isEmpty()) {
            return DungeonEditorWallBoundaryDraftInterpretation.from(new DungeonEditorMainViewInterpretation(
                    state,
                    DungeonEditorSessionEffect.clearPreviewIfNeeded(true)));
        }
        InteractionState nextState = state.withBoundaryDraft(
                state.boundaryDraft().completedAt(completionVertex(input, state), committedEdges));
        return applyBoundaryDraftOrPreview(input, snapshot, selectedTool, nextState.boundaryDraft().currentVertex(), nextState, true);
    }

    private static VertexKey completionVertex(PointerState input, InteractionState state) {
        return input.vertexTarget().present()
                ? new VertexKey(input.vertexTarget().q(), input.vertexTarget().r(), input.vertexTarget().level())
                : state.boundaryDraft().currentVertex();
    }

    private DungeonEditorMainViewInterpretation beginBoundaryDraft(
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            long clusterId,
            VertexTarget vertex,
            boolean deleteMode,
            VertexKey nextVertex,
            InteractionState state
    ) {
        if (!boundaryVertices.isEditableVertex(snapshot, clusterId, vertex, deleteMode)) {
            return new DungeonEditorMainViewInterpretation(state, DungeonEditorSessionEffect.none());
        }
        InteractionState nextState = state.withBoundaryDraft(BoundaryDraft.start(clusterId, deleteMode, nextVertex));
        return new DungeonEditorMainViewInterpretation(nextState, DungeonEditorSessionEffect.clearPreviewIfNeeded(true));
    }

    private DungeonEditorWallBoundaryDraftInterpretation advanceBoundaryDraft(
            PointerState input,
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            DungeonEditorSessionValues.Tool selectedTool,
            long clusterId,
            boolean deleteMode,
            VertexKey nextVertex,
            InteractionState state
    ) {
        PathResult path = deleteMode
                ? boundaryPaths.path(snapshot, clusterId, state.boundaryDraft().currentVertex(), nextVertex, true)
                : boundaryPaths.path(snapshot, clusterId, state.boundaryDraft().currentVertex(), nextVertex, false);
        if (!path.hasRoute()) {
            return DungeonEditorWallBoundaryDraftInterpretation.from(
                    new DungeonEditorMainViewInterpretation(
                            state,
                            DungeonEditorSessionEffect.clearPreviewIfNeeded(true)));
        }
        InteractionState nextState = state.withBoundaryDraft(state.boundaryDraft().advancedTo(
                nextVertex,
                path.committedEdges()));
        return applyBoundaryDraftOrPreview(input, snapshot, selectedTool, nextVertex, nextState, false);
    }

    private DungeonEditorWallBoundaryDraftInterpretation applyBoundaryDraftOrPreview(
            PointerState input,
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            DungeonEditorSessionValues.Tool selectedTool,
            VertexKey nextVertex,
            InteractionState state,
            boolean explicitCompletion
    ) {
        if (explicitCompletion
                || !state.boundaryDraft().deleteMode()
                && boundaryVertices.touchesExistingWall(snapshot, state.boundaryDraft().clusterId(), nextVertex)) {
            return draftEffects.applyWallDraft(state);
        }
        return DungeonEditorWallBoundaryDraftInterpretation.from(
                new DungeonEditorMainViewInterpretation(state, preview(input, snapshot, selectedTool, state)));
    }

}
