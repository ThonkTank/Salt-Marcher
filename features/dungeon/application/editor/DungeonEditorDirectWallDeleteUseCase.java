package features.dungeon.application.editor;

import java.util.Set;
import org.jspecify.annotations.Nullable;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues;
import features.dungeon.application.editor.DungeonEditorInteractionValues.CellKey;
import features.dungeon.application.editor.DungeonEditorInteractionValues.VertexKey;
import features.dungeon.application.editor.DungeonEditorInteractionValues.VertexTarget;
import features.dungeon.application.editor.DungeonEditorMainViewInteractionValues.BoundaryTarget;
import features.dungeon.application.editor.DungeonEditorMainViewInteractionValues.EdgeKey;
import features.dungeon.application.editor.DungeonEditorMainViewInteractionValues.InteractionState;
import features.dungeon.application.editor.DungeonEditorMainViewInteractionValues.PointerState;

final class DungeonEditorDirectWallDeleteUseCase {
    private final DungeonEditorBoundaryClusterResolutionHelper clusterResolver =
            new DungeonEditorBoundaryClusterResolutionHelper();
    private final DungeonEditorWallRunDeleteUseCase wallRuns = new DungeonEditorWallRunDeleteUseCase();
    private final DungeonEditorBoundaryDraftEffectHelper draftEffects = new DungeonEditorBoundaryDraftEffectHelper();

    @Nullable DungeonEditorMainViewInterpretation press(
            PointerState input,
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            DungeonEditorToolAction selectedTool,
            InteractionState state
    ) {
        if (input == null || !wallDeleteGesture(selectedTool, input)) {
            return null;
        }
        if (!input.vertexTarget().present() && directWallBoundaryTarget(input.boundaryTarget())) {
            return armDirectWallSegmentDelete(input.boundaryTarget(), snapshot, state);
        }
        if (input.vertexTarget().present()) {
            return armDirectWallCornerDelete(input, snapshot, state);
        }
        return armDirectWallCellDelete(input, snapshot, state);
    }

    DungeonEditorWallBoundaryDraftInterpretation releaseCorner(
            PointerState input,
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            InteractionState currentState,
            InteractionState nextState
    ) {
        return input != null && input.vertexTarget().present()
                ? applyDirectWallCornerDelete(input, snapshot, currentState, nextState)
                : DungeonEditorWallBoundaryDraftInterpretation.from(draftEffects.clearBoundaryDraftPreview(nextState));
    }

    private DungeonEditorMainViewInterpretation armDirectWallSegmentDelete(
            BoundaryTarget boundary,
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            InteractionState state
    ) {
        long clusterId = clusterResolver.resolveBoundaryClusterId(snapshot, boundary);
        if (!DungeonEditorWorkspaceValues.hasId(clusterId)) {
            return draftEffects.clearBoundaryDraftPreview(state);
        }
        return previewDelete(state, wallRuns.interiorRunForBoundary(snapshot, clusterId, boundary.edgeRef()));
    }

    private DungeonEditorMainViewInterpretation armDirectWallCornerDelete(
            PointerState input,
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            InteractionState state
    ) {
        VertexTarget vertex = input.vertexTarget();
        DungeonEditorWallDeleteTarget target =
                wallRuns.cornerRunDelete(snapshot, new VertexKey(vertex.q(), vertex.r(), vertex.level()));
        if (!DungeonEditorWorkspaceValues.hasId(target.clusterId())) {
            return draftEffects.clearBoundaryDraftPreview(state);
        }
        return previewDelete(state, target);
    }

    private DungeonEditorMainViewInterpretation armDirectWallCellDelete(
            PointerState input,
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            InteractionState state
    ) {
        DungeonEditorWallDeleteTarget target =
                wallRuns.cellRunDelete(snapshot, new CellKey(input.q(), input.r(), input.level()));
        if (!DungeonEditorWorkspaceValues.hasId(target.clusterId())) {
            return null;
        }
        return previewDelete(state, target);
    }

    private DungeonEditorWallBoundaryDraftInterpretation applyDirectWallCornerDelete(
            PointerState input,
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            InteractionState currentState,
            InteractionState nextState
    ) {
        VertexTarget vertex = input.vertexTarget();
        long clusterId = currentState.boundaryDraft().clusterId();
        if (!DungeonEditorWorkspaceValues.hasId(clusterId)) {
            return DungeonEditorWallBoundaryDraftInterpretation.from(draftEffects.clearBoundaryDraftPreview(nextState));
        }
        Set<EdgeKey> edges = wallRuns.cornerRunsForCluster(
                snapshot,
                clusterId,
                new VertexKey(vertex.q(), vertex.r(), vertex.level()));
        return edges.isEmpty()
                ? DungeonEditorWallBoundaryDraftInterpretation.from(draftEffects.clearBoundaryDraftPreview(nextState))
                : draftEffects.applyWallBoundaryEdges(nextState, clusterId, edges, true);
    }

    private DungeonEditorMainViewInterpretation previewDelete(
            InteractionState state,
            DungeonEditorWallDeleteTarget target
    ) {
        if (target.protectedExterior()) {
            return draftEffects.rejectExteriorWallDelete(state);
        }
        return target.edges().isEmpty()
                ? draftEffects.clearBoundaryDraftPreview(state)
                : draftEffects.previewWallDelete(target.clusterId(), target.edges(), state);
    }

    private static boolean directWallBoundaryTarget(BoundaryTarget boundary) {
        return boundary != null && boundary.present() && !boundary.doorKind();
    }

    private static boolean wallDeleteGesture(DungeonEditorToolAction selectedTool, PointerState input) {
        return input.secondaryButtonDown() && selectedTool.deleteMode();
    }
}
