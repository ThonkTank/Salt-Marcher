package src.domain.dungeon.model.runtime.helper;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorMainViewEffect;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorMainViewInteractionValues.BoundaryDraft;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorMainViewInteractionValues.EdgeKey;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorMainViewInteractionValues.InteractionState;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorMainViewInterpretation;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionValues;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues;

public final class DungeonEditorBoundaryDraftEffectHelper {
    public DungeonEditorMainViewInterpretation previewWallDelete(
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
        return new DungeonEditorMainViewInterpretation(nextState, DungeonEditorMainViewEffect.preview(
                new DungeonEditorSessionValues.ClusterBoundariesPreview(
                        clusterId,
                        edgeRefs(edges),
                        DungeonEditorWorkspaceValues.BoundaryKind.WALL,
                        true)));
    }

    public DungeonEditorMainViewInterpretation applyBoundaryEdges(
            InteractionState nextState,
            long clusterId,
            Set<EdgeKey> edges,
            boolean deleteMode
    ) {
        return new DungeonEditorMainViewInterpretation(nextState, DungeonEditorMainViewEffect.apply(
                boundaryPreview(clusterId, edges, deleteMode)));
    }

    public DungeonEditorMainViewEffect previewBoundaryEdges(
            long clusterId,
            Set<EdgeKey> edges,
            boolean deleteMode
    ) {
        return DungeonEditorMainViewEffect.preview(boundaryPreview(clusterId, edges, deleteMode));
    }

    public DungeonEditorMainViewInterpretation applyWallDraft(InteractionState state) {
        BoundaryDraft current = state.boundaryDraft();
        InteractionState nextState = state.withBoundaryDraft(BoundaryDraft.none());
        if (current.previewEdges().isEmpty()) {
            return clearBoundaryDraftPreview(nextState);
        }
        return applyBoundaryEdges(nextState, current.clusterId(), current.previewEdges(), current.deleteMode());
    }

    public DungeonEditorMainViewInterpretation preserveActiveDraftOrClearState(InteractionState state) {
        return new DungeonEditorMainViewInterpretation(
                state.boundaryDraft().present() ? state : state.clear(),
                DungeonEditorMainViewEffect.none());
    }

    public DungeonEditorMainViewInterpretation clearBoundaryDraftPreview(InteractionState state) {
        return new DungeonEditorMainViewInterpretation(
                state.withBoundaryDraft(BoundaryDraft.none()),
                DungeonEditorMainViewEffect.clearPreviewIfNeeded(true));
    }

    public DungeonEditorMainViewInterpretation rejectExteriorWallDelete(InteractionState state) {
        return new DungeonEditorMainViewInterpretation(
                state.withBoundaryDraft(BoundaryDraft.none()),
                DungeonEditorMainViewEffect.clearPreviewWithStatus("Cluster-Aussenwand kann nicht gelöscht werden."));
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

    private static List<DungeonEditorWorkspaceValues.Edge> edgeRefs(Set<EdgeKey> edges) {
        List<DungeonEditorWorkspaceValues.Edge> result = new ArrayList<>();
        for (EdgeKey edge : edges) {
            result.add(edge.toEdgeRef());
        }
        return List.copyOf(result);
    }
}
