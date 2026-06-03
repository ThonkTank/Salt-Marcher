package src.domain.dungeon.model.worldspace.usecase;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.worldspace.helper.DungeonEditorBoundaryClusterResolutionHelper;
import src.domain.dungeon.model.worldspace.helper.DungeonEditorBoundaryEdgesHelper;
import src.domain.dungeon.model.worldspace.interaction.model.DungeonEditorInteractionValues;
import src.domain.dungeon.model.worldspace.interaction.model.DungeonEditorInteractionValues.VertexKey;
import src.domain.dungeon.model.worldspace.interaction.model.DungeonEditorInteractionValues.VertexTarget;
import src.domain.dungeon.model.worldspace.interaction.model.DungeonEditorMainViewEffect;
import src.domain.dungeon.model.worldspace.interaction.model.DungeonEditorMainViewInteractionValues.BoundaryDraft;
import src.domain.dungeon.model.worldspace.interaction.model.DungeonEditorMainViewInteractionValues.BoundaryTarget;
import src.domain.dungeon.model.worldspace.interaction.model.DungeonEditorMainViewInteractionValues.EdgeKey;
import src.domain.dungeon.model.worldspace.interaction.model.DungeonEditorMainViewInteractionValues.InteractionState;
import src.domain.dungeon.model.worldspace.interaction.model.DungeonEditorMainViewInteractionValues.PointerState;
import src.domain.dungeon.model.worldspace.interaction.model.DungeonEditorMainViewInterpretation;
import src.domain.dungeon.model.worldspace.session.model.DungeonEditorSessionValues;
import src.domain.dungeon.model.worldspace.workspace.model.DungeonEditorWorkspaceValues;

final class DungeonEditorDirectWallDeleteUseCase {
    private final DungeonEditorBoundaryClusterResolutionHelper clusterResolver =
            new DungeonEditorBoundaryClusterResolutionHelper();
    private final DungeonEditorBoundaryEdgesHelper boundaryEdges = new DungeonEditorBoundaryEdgesHelper();
    private final DungeonEditorBoundaryVertexUseCase boundaryVertices = new DungeonEditorBoundaryVertexUseCase();

    @Nullable DungeonEditorMainViewInterpretation press(
            PointerState input,
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            DungeonEditorSessionValues.Tool selectedTool,
            InteractionState state
    ) {
        if (input == null || !selectedTool.deleteMode() || !input.secondaryButtonDown()) {
            return null;
        }
        if (!input.vertexTarget().present() && directWallBoundaryTarget(input.boundaryTarget())) {
            return armDirectWallSegmentDelete(input.boundaryTarget(), snapshot, state);
        }
        return null;
    }

    DungeonEditorMainViewInterpretation releaseCorner(
            PointerState input,
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            InteractionState currentState,
            InteractionState nextState
    ) {
        return input != null && input.vertexTarget().present()
                ? applyDirectWallCornerDelete(input, snapshot, currentState, nextState)
                : clearDraft(nextState);
    }

    private DungeonEditorMainViewInterpretation armDirectWallSegmentDelete(
            BoundaryTarget boundary,
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            InteractionState state
    ) {
        long clusterId = clusterResolver.resolveBoundaryClusterId(snapshot, boundary);
        if (!DungeonEditorWorkspaceValues.hasId(clusterId)) {
            return clearDraft(state);
        }
        EdgeKey edge = EdgeKey.from(boundary.edgeRef());
        return previewEdges(clusterId, Set.of(edge), state);
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
            return clearDraft(nextState);
        }
        Set<EdgeKey> edges = wallEdgesTouchingVertex(snapshot, clusterId, DungeonEditorInteractionValues.vertexKey(vertex));
        return edges.isEmpty() ? clearDraft(nextState) : applyEdges(clusterId, edges, nextState);
    }

    private Set<EdgeKey> wallEdgesTouchingVertex(
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            long clusterId,
            VertexKey vertex
    ) {
        Set<DungeonEditorInteractionValues.CellKey> cells = boundaryVertices.clusterCellsFor(snapshot, clusterId, vertex.level());
        Set<EdgeKey> walls = boundaryEdges.existingAlongClusterBoundary(
                snapshot,
                cells,
                vertex.level(),
                DungeonEditorWorkspaceValues.BoundaryKind.WALL);
        Set<EdgeKey> result = new LinkedHashSet<>();
        for (EdgeKey edge : walls) {
            if (edge.touches(vertex)) {
                result.add(edge);
            }
        }
        return Set.copyOf(result);
    }

    private static DungeonEditorMainViewInterpretation previewEdges(
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

    private static DungeonEditorMainViewInterpretation applyEdges(
            long clusterId,
            Set<EdgeKey> edges,
            InteractionState state
    ) {
        return new DungeonEditorMainViewInterpretation(state, DungeonEditorMainViewEffect.apply(
                new DungeonEditorSessionValues.ClusterBoundariesPreview(
                        clusterId,
                        edgeRefs(edges),
                        DungeonEditorWorkspaceValues.BoundaryKind.WALL,
                        true)));
    }

    private static List<DungeonEditorWorkspaceValues.Edge> edgeRefs(Set<EdgeKey> edges) {
        List<DungeonEditorWorkspaceValues.Edge> result = new ArrayList<>();
        for (EdgeKey edge : edges) {
            result.add(edge.toEdgeRef());
        }
        return List.copyOf(result);
    }

    private static DungeonEditorMainViewInterpretation clearDraft(InteractionState state) {
        return new DungeonEditorMainViewInterpretation(
                state.withBoundaryDraft(BoundaryDraft.none()),
                DungeonEditorMainViewEffect.clearPreviewIfNeeded(true));
    }

    private static boolean directWallBoundaryTarget(BoundaryTarget boundary) {
        return boundary != null && boundary.present() && !boundary.doorKind();
    }
}
