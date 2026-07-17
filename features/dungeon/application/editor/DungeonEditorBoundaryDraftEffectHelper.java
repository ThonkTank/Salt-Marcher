package features.dungeon.application.editor;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import features.dungeon.application.editor.session.DungeonEditorSessionEffect;
import features.dungeon.application.editor.session.DungeonEditorSessionValues;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues;
import features.dungeon.api.editor.DungeonEditorCommandOutcome;
import features.dungeon.application.editor.DungeonEditorMainViewInteractionValues.BoundaryDraft;
import features.dungeon.application.editor.DungeonEditorMainViewInteractionValues.EdgeKey;
import features.dungeon.application.editor.DungeonEditorMainViewInteractionValues.InteractionState;

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
                        features.dungeon.domain.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryKind.WALL,
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
                DungeonEditorSessionEffect.rejected(
                        DungeonEditorCommandOutcome.RejectionReason.PROTECTED_EXTERIOR_WALL));
    }

    private static DungeonEditorSessionValues.ClusterBoundariesPreview boundaryPreview(
            long clusterId,
            Set<EdgeKey> edges,
            boolean deleteMode
    ) {
        return new DungeonEditorSessionValues.ClusterBoundariesPreview(
                clusterId,
                edgeRefs(edges),
                features.dungeon.domain.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryKind.WALL,
                deleteMode);
    }

    static List<features.dungeon.domain.core.geometry.Edge> edgeRefs(Set<EdgeKey> edges) {
        List<features.dungeon.domain.core.geometry.Edge> result = new ArrayList<>();
        for (EdgeKey edge : edges) {
            result.add(edge.toEdgeRef());
        }
        return List.copyOf(result);
    }
}
