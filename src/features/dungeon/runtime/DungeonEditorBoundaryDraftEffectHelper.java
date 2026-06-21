package src.features.dungeon.runtime;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionEffect;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionValues;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues;
import src.features.dungeon.runtime.DungeonEditorMainViewInteractionValues.BoundaryDraft;
import src.features.dungeon.runtime.DungeonEditorMainViewInteractionValues.EdgeKey;
import src.features.dungeon.runtime.DungeonEditorMainViewInteractionValues.InteractionState;

final class DungeonEditorBoundaryDraftEffectHelper {
    DungeonEditorMainViewInterpretation previewWallDelete(
            long clusterId,
            Set<EdgeKey> edges,
            InteractionState state
    ) {
        EdgeKey firstEdge = edges.iterator().next();
        InteractionState nextState = state.withBoundaryDraft(new BoundaryDraft(
                clusterId,
                true,
                firstEdge.start(),
                firstEdge.end(),
                edges,
                true));
        return new DungeonEditorMainViewInterpretation(nextState, DungeonEditorSessionEffect.preview(
                new DungeonEditorSessionValues.ClusterBoundariesPreview(
                        clusterId,
                        edgeRefs(edges),
                        DungeonEditorWorkspaceValues.BoundaryKind.WALL,
                        true)));
    }

    DungeonEditorWallBoundaryDraftInterpretation applyWallBoundaryEdges(
            InteractionState nextState,
            long clusterId,
            Set<EdgeKey> edges,
            boolean deleteMode
    ) {
        return new DungeonEditorWallBoundaryDraftInterpretation(
                nextState,
                DungeonEditorSessionEffect.apply(boundaryPreview(clusterId, edges, deleteMode)),
                new DungeonEditorWallBoundaryDraftInterpretation.WallBoundaryCommit(clusterId, edges, deleteMode));
    }

    DungeonEditorSessionEffect previewBoundaryEdges(
            long clusterId,
            Set<EdgeKey> edges,
            boolean deleteMode
    ) {
        return DungeonEditorSessionEffect.preview(boundaryPreview(clusterId, edges, deleteMode));
    }

    DungeonEditorWallBoundaryDraftInterpretation applyWallDraft(InteractionState state) {
        BoundaryDraft current = state.boundaryDraft();
        InteractionState nextState = state.withBoundaryDraft(BoundaryDraft.none());
        if (current.previewEdges().isEmpty()) {
            return DungeonEditorWallBoundaryDraftInterpretation.from(clearBoundaryDraftPreview(nextState));
        }
        return applyWallBoundaryEdges(nextState, current.clusterId(), current.previewEdges(), current.deleteMode());
    }

    DungeonEditorMainViewInterpretation preserveActiveDraftOrClearState(InteractionState state) {
        return new DungeonEditorMainViewInterpretation(
                state.boundaryDraft().present() ? state : state.clear(),
                DungeonEditorSessionEffect.none());
    }

    DungeonEditorMainViewInterpretation clearBoundaryDraftPreview(InteractionState state) {
        return new DungeonEditorMainViewInterpretation(
                state.withBoundaryDraft(BoundaryDraft.none()),
                DungeonEditorSessionEffect.clearPreviewIfNeeded(true));
    }

    DungeonEditorMainViewInterpretation rejectExteriorWallDelete(InteractionState state) {
        return new DungeonEditorMainViewInterpretation(
                state.withBoundaryDraft(BoundaryDraft.none()),
                DungeonEditorSessionEffect.clearPreviewWithStatus("Cluster-Aussenwand kann nicht gelöscht werden."));
    }

    private static DungeonEditorSessionValues.ClusterBoundariesPreview boundaryPreview(
            long clusterId,
            Set<EdgeKey> edges,
            boolean deleteMode
    ) {
        return new DungeonEditorSessionValues.ClusterBoundariesPreview(
                clusterId,
                edgeRefs(edges),
                DungeonEditorWorkspaceValues.BoundaryKind.WALL,
                deleteMode);
    }

    static List<DungeonEditorWorkspaceValues.Edge> edgeRefs(Set<EdgeKey> edges) {
        List<DungeonEditorWorkspaceValues.Edge> result = new ArrayList<>();
        for (EdgeKey edge : edges) {
            result.add(edge.toEdgeRef());
        }
        return List.copyOf(result);
    }
}
