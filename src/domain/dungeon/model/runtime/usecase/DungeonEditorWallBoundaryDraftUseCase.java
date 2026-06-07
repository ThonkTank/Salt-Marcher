package src.domain.dungeon.model.runtime.usecase;

import java.util.LinkedHashSet;
import java.util.Set;
import src.domain.dungeon.model.runtime.helper.DungeonEditorBoundaryDraftEffectHelper;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorInteractionValues.VertexKey;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorInteractionValues.VertexTarget;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorMainViewEffect;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorMainViewInteractionValues.BoundaryDraft;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorMainViewInteractionValues.EdgeKey;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorMainViewInteractionValues.InteractionState;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorMainViewInteractionValues.PathResult;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorMainViewInteractionValues.PointerState;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorMainViewInterpretation;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionValues;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues;

final class DungeonEditorWallBoundaryDraftUseCase {
    private final DungeonEditorBoundaryClusterUseCase boundaryClusters = new DungeonEditorBoundaryClusterUseCase();
    private final DungeonEditorDirectWallDeleteUseCase directWallDelete = new DungeonEditorDirectWallDeleteUseCase();
    private final DungeonEditorBoundaryVertexUseCase boundaryVertices = new DungeonEditorBoundaryVertexUseCase();
    private final DungeonEditorBoundaryPathUseCase boundaryPaths = new DungeonEditorBoundaryPathUseCase();
    private final DungeonEditorBoundaryDraftEffectHelper draftEffects = new DungeonEditorBoundaryDraftEffectHelper();

    DungeonEditorMainViewInterpretation press(
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
            return directDelete;
        }
        return pressVertexBoundary(input, snapshot, currentSelection, selectedTool, state);
    }

    private DungeonEditorMainViewInterpretation pressVertexBoundary(
            PointerState input,
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            DungeonEditorSessionValues.Selection currentSelection,
            DungeonEditorSessionValues.Tool selectedTool,
            InteractionState state
    ) {
        var vertex = input.vertexTarget();
        if (vertex == null || !vertex.present()) {
            return draftEffects.preserveActiveDraftOrClearState(state);
        }
        boolean deleteMode = selectedTool.deleteMode();
        long clusterId = boundaryClusters.resolveClusterId(input, vertex, deleteMode, snapshot, currentSelection);
        if (!DungeonEditorWorkspaceValues.hasId(clusterId)) {
            return draftEffects.preserveActiveDraftOrClearState(state);
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
        if (!state.boundaryDraft().present()) {
            return DungeonEditorMainViewEffect.clearPreviewIfNeeded(false);
        }
        Set<EdgeKey> previewEdges = new LinkedHashSet<>(state.boundaryDraft().previewEdges());
        PathResult candidate = boundaryPaths.previewCandidate(
                input,
                snapshot,
                state.boundaryDraft(),
                selectedTool.deleteMode());
        previewEdges.addAll(candidate.committedEdges());
        if (previewEdges.isEmpty()) {
            return DungeonEditorMainViewEffect.clearPreviewIfNeeded(true);
        }
        return draftEffects.previewBoundaryEdges(
                state.boundaryDraft().clusterId(),
                previewEdges,
                state.boundaryDraft().deleteMode());
    }

    DungeonEditorMainViewInterpretation release(
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
                return new DungeonEditorMainViewInterpretation(
                        state,
                        DungeonEditorMainViewEffect.clearPreviewIfNeeded(false));
            }
            if (!input.wallSingleClickMode()) {
                return new DungeonEditorMainViewInterpretation(state, preview(input, snapshot, selectedTool, state));
            }
            Set<EdgeKey> committedEdges = new LinkedHashSet<>(state.boundaryDraft().previewEdges());
            PathResult candidate = boundaryPaths.previewCandidate(input, snapshot, state.boundaryDraft(), false);
            committedEdges.addAll(candidate.committedEdges());
            if (committedEdges.isEmpty()) {
                return new DungeonEditorMainViewInterpretation(
                        state,
                        DungeonEditorMainViewEffect.clearPreviewIfNeeded(true));
            }
            InteractionState nextState = state.withBoundaryDraft(BoundaryDraft.none());
            return draftEffects.applyBoundaryEdges(nextState, state.boundaryDraft().clusterId(), committedEdges, false);
        }
        return releaseDeleteDraft(input, snapshot, state);
    }

    private DungeonEditorMainViewInterpretation releaseDeleteDraft(
            PointerState input,
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            InteractionState state
    ) {
        InteractionState nextState = state.withBoundaryDraft(BoundaryDraft.none());
        if (!state.boundaryDraft().present() || !state.boundaryDraft().deleteMode() || input == null) {
            return draftEffects.clearBoundaryDraftPreview(nextState);
        }
        Set<EdgeKey> committedEdges = new LinkedHashSet<>(state.boundaryDraft().previewEdges());
        PathResult candidate = boundaryPaths.previewCandidate(input, snapshot, state.boundaryDraft(), true);
        committedEdges.addAll(candidate.committedEdges());
        if (committedEdges.isEmpty()) {
            return directWallDelete.releaseCorner(input, snapshot, state, nextState);
        }
        return draftEffects.applyBoundaryEdges(nextState, state.boundaryDraft().clusterId(), committedEdges, true);
    }

    private DungeonEditorMainViewInterpretation completeActiveCreateDraft(
            PointerState input,
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            DungeonEditorSessionValues.Tool selectedTool,
            InteractionState state
    ) {
        Set<EdgeKey> committedEdges = new LinkedHashSet<>(state.boundaryDraft().previewEdges());
        PathResult candidate = boundaryPaths.previewCandidate(input, snapshot, state.boundaryDraft(), false);
        committedEdges.addAll(candidate.committedEdges());
        if (committedEdges.isEmpty()) {
            return new DungeonEditorMainViewInterpretation(
                    state,
                    DungeonEditorMainViewEffect.clearPreviewIfNeeded(true));
        }
        InteractionState nextState = state.withBoundaryDraft(new BoundaryDraft(
                state.boundaryDraft().clusterId(),
                false,
                state.boundaryDraft().startVertex(),
                completionVertex(input, state),
                committedEdges,
                true));
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
                ? boundaryPaths.path(snapshot, clusterId, state.boundaryDraft().currentVertex(), nextVertex, true)
                : boundaryPaths.path(snapshot, clusterId, state.boundaryDraft().currentVertex(), nextVertex, false);
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
        return applyBoundaryDraftOrPreview(input, snapshot, selectedTool, nextVertex, nextState, false);
    }

    private DungeonEditorMainViewInterpretation applyBoundaryDraftOrPreview(
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
        return new DungeonEditorMainViewInterpretation(state, preview(input, snapshot, selectedTool, state));
    }

}
