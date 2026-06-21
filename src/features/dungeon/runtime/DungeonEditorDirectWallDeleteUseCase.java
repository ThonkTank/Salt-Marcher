package src.features.dungeon.runtime;

import java.util.Set;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionValues;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues;
import src.features.dungeon.runtime.DungeonEditorInteractionValues.CellKey;
import src.features.dungeon.runtime.DungeonEditorInteractionValues.VertexKey;
import src.features.dungeon.runtime.DungeonEditorInteractionValues.VertexTarget;
import src.features.dungeon.runtime.DungeonEditorMainViewInteractionValues.BoundaryTarget;
import src.features.dungeon.runtime.DungeonEditorMainViewInteractionValues.EdgeKey;
import src.features.dungeon.runtime.DungeonEditorMainViewInteractionValues.InteractionState;
import src.features.dungeon.runtime.DungeonEditorMainViewInteractionValues.PointerState;

final class DungeonEditorDirectWallDeleteUseCase {
    private final DungeonEditorBoundaryClusterResolutionHelper clusterResolver =
            new DungeonEditorBoundaryClusterResolutionHelper();
    private final DungeonEditorWallRunDeleteUseCase wallRuns = new DungeonEditorWallRunDeleteUseCase();
    private final DungeonEditorBoundaryDraftEffectHelper draftEffects = new DungeonEditorBoundaryDraftEffectHelper();

    @Nullable DungeonEditorMainViewInterpretation press(
            PointerState input,
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            DungeonEditorSessionValues.Tool selectedTool,
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

    DungeonEditorMainViewInterpretation releaseCorner(
            PointerState input,
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            InteractionState currentState,
            InteractionState nextState
    ) {
        return input != null && input.vertexTarget().present()
                ? applyDirectWallCornerDelete(input, snapshot, currentState, nextState)
                : draftEffects.clearBoundaryDraftPreview(nextState);
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

    private DungeonEditorMainViewInterpretation applyDirectWallCornerDelete(
            PointerState input,
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            InteractionState currentState,
            InteractionState nextState
    ) {
        VertexTarget vertex = input.vertexTarget();
        long clusterId = currentState.boundaryDraft().clusterId();
        if (!DungeonEditorWorkspaceValues.hasId(clusterId)) {
            return draftEffects.clearBoundaryDraftPreview(nextState);
        }
        Set<EdgeKey> edges = wallRuns.cornerRunsForCluster(
                snapshot,
                clusterId,
                new VertexKey(vertex.q(), vertex.r(), vertex.level()));
        return edges.isEmpty()
                ? draftEffects.clearBoundaryDraftPreview(nextState)
                : draftEffects.applyBoundaryEdges(nextState, clusterId, edges, true);
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

    private static boolean wallDeleteGesture(DungeonEditorSessionValues.Tool selectedTool, PointerState input) {
        return input.secondaryButtonDown()
                && (selectedTool.deleteMode() || selectedTool == DungeonEditorSessionValues.Tool.WALL_CREATE);
    }
}
