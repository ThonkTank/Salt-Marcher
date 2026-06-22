package src.features.dungeon.runtime;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.graph.DungeonTopologyRef;
import src.domain.dungeon.model.core.structure.room.BoundaryStretchOrientation;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionValues;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues;
import src.features.dungeon.runtime.DungeonEditorInteractionValues.CellKey;
import src.features.dungeon.runtime.DungeonEditorMainViewInteractionValues.BoundaryStretchSession;
import src.features.dungeon.runtime.DungeonEditorMainViewInteractionValues.BoundaryStretchSide;
import src.features.dungeon.runtime.DungeonEditorMainViewInteractionValues.BoundaryTarget;
import src.features.dungeon.runtime.DungeonEditorMainViewInteractionValues.PointerState;

final class DungeonEditorBoundaryStretchHelper {
    private final StretchStarter starter = new StretchStarter();
    private final StretchEdges edges = new StretchEdges();

    @Nullable BoundaryStretchSession start(
            PointerState input,
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            DungeonEditorSessionValues.Selection currentSelection
    ) {
        return starter.start(input, snapshot, currentSelection, edges);
    }

    private static final class StretchStarter {
        private @Nullable BoundaryStretchSession start(
                PointerState input,
                DungeonEditorWorkspaceValues.MapSnapshot snapshot,
                DungeonEditorSessionValues.Selection currentSelection,
                StretchEdges edges
        ) {
            BoundaryTarget boundaryTarget = stretchBoundaryTarget(input, currentSelection);
            if (boundaryTarget == null) {
                return null;
            }
            BoundaryStretchOrientation orientation = StretchGeometry.orientation(boundaryTarget);
            if (orientation == null) {
                return null;
            }
            long clusterId = boundaryTarget.clusterId() > 0L
                    ? boundaryTarget.clusterId()
                    : StretchCluster.resolveBoundaryClusterId(snapshot, boundaryTarget);
            if (!DungeonEditorWorkspaceValues.hasId(clusterId)) {
                return null;
            }
            List<DungeonEditorWorkspaceValues.Edge> sourceEdges = sourceEdges(input, snapshot, clusterId, boundaryTarget,
                    orientation, edges);
            if (sourceEdges.isEmpty()) {
                return null;
            }
            return session(input, sourceEdges, orientation, selection(snapshot, currentSelection, clusterId, boundaryTarget), clusterId);
        }

        private static List<DungeonEditorWorkspaceValues.Edge> sourceEdges(
                PointerState input,
                DungeonEditorWorkspaceValues.MapSnapshot snapshot,
                long clusterId,
                BoundaryTarget boundaryTarget,
                BoundaryStretchOrientation orientation,
            StretchEdges edges
        ) {
            if (input.hitTarget().handleRef().clusterWallRun()) {
                return handleSourceEdges(input.hitTarget().handleRef());
            }
            return edges.resolve(snapshot, clusterId, boundaryTarget, orientation);
        }

        private static List<DungeonEditorWorkspaceValues.Edge> handleSourceEdges(
                DungeonEditorMainViewInteractionValues.HandleTarget handle
        ) {
            return handle.sourceEdges();
        }

        private static @Nullable BoundaryTarget stretchBoundaryTarget(
                @Nullable PointerState input,
                DungeonEditorSessionValues.@Nullable Selection currentSelection
        ) {
            if (input == null || !input.primaryButtonDown()) {
                return null;
            }
            if (input.hitTarget().handleRef().clusterWallRun()) {
                return DungeonEditorWallRunBoundaryTargetResolver.resolve(input, currentSelection);
            }
            BoundaryTarget boundaryTarget = input.boundaryTarget();
            if (boundaryTarget == null || !boundaryTarget.present() || boundaryTarget.doorKind()) {
                return DungeonEditorWallRunBoundaryTargetResolver.resolve(input, currentSelection);
            }
            return boundaryTarget;
        }

        private static BoundaryStretchSession session(
                PointerState input,
                List<DungeonEditorWorkspaceValues.Edge> sourceEdges,
                BoundaryStretchOrientation orientation,
                DungeonEditorSessionValues.Selection selection,
                long clusterId
        ) {
            return new BoundaryStretchSession(
                    selection,
                    clusterId,
                    sourceEdges,
                    orientation,
                    input.q(),
                    input.r(),
                    input.level(),
                    input.q(),
                    input.r(),
                    true);
        }

        private static DungeonEditorSessionValues.Selection selection(
                DungeonEditorWorkspaceValues.MapSnapshot snapshot,
                DungeonEditorSessionValues.Selection currentSelection,
                long clusterId,
                BoundaryTarget boundaryTarget
        ) {
            if (currentSelection != null && currentSelection.clusterSelection() && currentSelection.clusterId() == clusterId) {
                return currentSelection;
            }
            DungeonEditorSessionValues.Selection areaSelection = areaSelection(snapshot, clusterId);
            return areaSelection == null ? boundarySelection(boundaryTarget, clusterId) : areaSelection;
        }

        private static DungeonEditorSessionValues.@Nullable Selection areaSelection(
                DungeonEditorWorkspaceValues.MapSnapshot snapshot,
                long clusterId
        ) {
            if (snapshot == null || clusterId <= 0L) {
                return null;
            }
            for (DungeonEditorWorkspaceValues.Area area : snapshot.areas()) {
                if (area.kind().isRoom() && area.clusterId() == clusterId) {
                    return new DungeonEditorSessionValues.Selection(
                            area.topologyRef(),
                            area.clusterId(),
                            true,
                            DungeonEditorSessionValues.emptyHandleRef());
                }
            }
            return null;
        }

        private static DungeonEditorSessionValues.Selection boundarySelection(BoundaryTarget boundaryTarget, long clusterId) {
            return new DungeonEditorSessionValues.Selection(
                    new DungeonTopologyRef(
                            DungeonEditorMainViewInteractionValues.toTopologyKind(boundaryTarget.topologyRefKind()),
                            boundaryTarget.topologyRefId()),
                    clusterId,
                    true,
                    DungeonEditorSessionValues.emptyHandleRef());
        }
    }

    private static final class StretchEdges {
        private List<DungeonEditorWorkspaceValues.Edge> resolve(
                DungeonEditorWorkspaceValues.MapSnapshot snapshot,
                long clusterId,
                BoundaryTarget boundaryTarget,
                BoundaryStretchOrientation orientation
        ) {
            if (snapshot == null || !boundaryTarget.present() || !DungeonEditorWorkspaceValues.hasId(clusterId)) {
                return List.of();
            }
            Set<DungeonEditorWorkspaceValues.Cell> clusterCells =
                    StretchCluster.clusterCells(snapshot, clusterId, boundaryTarget.start().level());
            if (clusterCells.isEmpty()) {
                return List.of();
            }
            DungeonEditorWorkspaceValues.Edge clickedEdge = boundaryTarget.edgeRef();
            BoundaryStretchSide stretchSide = stretchSide(clickedEdge, clusterCells);
            if (stretchSide == BoundaryStretchSide.NONE) {
                return List.of();
            }
            Map<Integer, DungeonEditorWorkspaceValues.Edge> lineEdges =
                    edgesOnLine(snapshot, clusterCells, clickedEdge, orientation, stretchSide.outer());
            List<DungeonEditorWorkspaceValues.Edge> contiguousEdges =
                    StretchGeometry.contiguousEdges(lineEdges, clickedEdge, orientation);
            return contiguousEdges.isEmpty() ? List.of(clickedEdge) : contiguousEdges;
        }

        private static BoundaryStretchSide stretchSide(
                DungeonEditorWorkspaceValues.Edge clickedEdge,
                Set<DungeonEditorWorkspaceValues.Cell> clusterCells
        ) {
            return switch (DungeonEditorBoundaryTouchGeometry.fromEdge(clickedEdge).touchingCount(clusterCells)) {
                case 0 -> BoundaryStretchSide.NONE;
                case 1 -> BoundaryStretchSide.OUTER;
                default -> BoundaryStretchSide.INNER;
            };
        }

        private static Map<Integer, DungeonEditorWorkspaceValues.Edge> edgesOnLine(
                DungeonEditorWorkspaceValues.MapSnapshot snapshot,
                Set<DungeonEditorWorkspaceValues.Cell> clusterCells,
                DungeonEditorWorkspaceValues.Edge clickedEdge,
                BoundaryStretchOrientation orientation,
                boolean outer
        ) {
            Map<Integer, DungeonEditorWorkspaceValues.Edge> edgesByVariable = new LinkedHashMap<>();
            int level = clickedEdge.from().level();
            int fixedCoordinate = StretchGeometry.fixedCoordinate(clickedEdge, orientation);
            for (DungeonEditorWorkspaceValues.Boundary boundary : snapshot.boundaries()) {
                addIfMatching(edgesByVariable, boundary.edge(), clusterCells, level, orientation, fixedCoordinate, outer);
            }
            return Map.copyOf(edgesByVariable);
        }

        private static void addIfMatching(
                Map<Integer, DungeonEditorWorkspaceValues.Edge> edgesByVariable,
                DungeonEditorWorkspaceValues.Edge edge,
                Set<DungeonEditorWorkspaceValues.Cell> clusterCells,
                int level,
                BoundaryStretchOrientation orientation,
                int fixedCoordinate,
                boolean outer
        ) {
            if (StretchGeometry.matchesLine(edge, clusterCells, level, orientation, fixedCoordinate, outer)) {
                edgesByVariable.put(StretchGeometry.variableCoordinate(edge, orientation), edge);
            }
        }
    }

    private static final class StretchCluster {
        private static long resolveBoundaryClusterId(
                DungeonEditorWorkspaceValues.@Nullable MapSnapshot snapshot,
                @Nullable BoundaryTarget boundaryTarget
        ) {
            if (snapshot == null || boundaryTarget == null || !boundaryTarget.present()) {
                return 0L;
            }
            List<CellKey> touchingCells =
                    DungeonEditorBoundaryTouchGeometry.fromEdge(boundaryTarget.edgeRef()).touchingCellKeys();
            for (DungeonEditorWorkspaceValues.Area area : snapshot.areas()) {
                if (area.kind().isRoom()
                        && DungeonEditorWorkspaceValues.hasId(area.clusterId())
                        && areaTouchesCells(area, touchingCells)) {
                    return area.clusterId();
                }
            }
            return 0L;
        }

        private static Set<DungeonEditorWorkspaceValues.Cell> clusterCells(
                DungeonEditorWorkspaceValues.MapSnapshot snapshot,
                long clusterId,
                int level
        ) {
            if (snapshot == null || !DungeonEditorWorkspaceValues.hasId(clusterId)) {
                return Set.of();
            }
            Set<DungeonEditorWorkspaceValues.Cell> result = new LinkedHashSet<>();
            for (DungeonEditorWorkspaceValues.Area area : snapshot.areas()) {
                collectClusterCells(result, area, clusterId, level);
            }
            return Set.copyOf(result);
        }

        private static void collectClusterCells(
                Set<DungeonEditorWorkspaceValues.Cell> result,
                DungeonEditorWorkspaceValues.Area area,
                long clusterId,
                int level
        ) {
            if (!area.kind().isRoom() || area.clusterId() != clusterId) {
                return;
            }
            for (DungeonEditorWorkspaceValues.Cell cell : area.cells()) {
                if (cell.level() == level) {
                    result.add(cell);
                }
            }
        }

        private static boolean areaTouchesCells(
                DungeonEditorWorkspaceValues.Area area,
                List<CellKey> touchingCells
        ) {
            for (DungeonEditorWorkspaceValues.Cell cell : area.cells()) {
                if (touchingCells.contains(new CellKey(cell.q(), cell.r(), cell.level()))) {
                    return true;
                }
            }
            return false;
        }
    }

    private static final class StretchGeometry {
        private static @Nullable BoundaryStretchOrientation orientation(BoundaryTarget boundaryTarget) {
            if (boundaryTarget == null || !boundaryTarget.present()) {
                return null;
            }
            if (boundaryTarget.start().q() == boundaryTarget.end().q()) {
                return BoundaryStretchOrientation.VERTICAL;
            }
            if (boundaryTarget.start().r() == boundaryTarget.end().r()) {
                return BoundaryStretchOrientation.HORIZONTAL;
            }
            return null;
        }

        private static List<DungeonEditorWorkspaceValues.Edge> contiguousEdges(
                Map<Integer, DungeonEditorWorkspaceValues.Edge> edgesByVariable,
                DungeonEditorWorkspaceValues.Edge clickedEdge,
                BoundaryStretchOrientation orientation
        ) {
            int min = variableCoordinate(clickedEdge, orientation);
            int max = min;
            while (edgesByVariable.containsKey(min - 1)) {
                min--;
            }
            while (edgesByVariable.containsKey(max + 1)) {
                max++;
            }
            return contiguousRange(edgesByVariable, min, max);
        }

        private static boolean matchesLine(
                DungeonEditorWorkspaceValues.Edge edge,
                Set<DungeonEditorWorkspaceValues.Cell> clusterCells,
                int level,
                BoundaryStretchOrientation orientation,
                int fixedCoordinate,
                boolean outer
        ) {
            if (edge == null
                    || edge.from() == null
                    || edge.to() == null
                    || edge.from().level() != level
                    || edge.to().level() != level
                    || !sameOrientation(orientation, edge)
                    || fixedCoordinate(edge, orientation) != fixedCoordinate) {
                return false;
            }
            int touchCount = DungeonEditorBoundaryTouchGeometry.fromEdge(edge).touchingCount(clusterCells);
            return touchCount > 0 && touchCount == 1 == outer;
        }

        private static int fixedCoordinate(DungeonEditorWorkspaceValues.Edge edge, BoundaryStretchOrientation orientation) {
            return orientation == BoundaryStretchOrientation.VERTICAL ? edge.from().q() : edge.from().r();
        }

        private static int variableCoordinate(DungeonEditorWorkspaceValues.Edge edge, BoundaryStretchOrientation orientation) {
            return orientation == BoundaryStretchOrientation.VERTICAL
                    ? Math.min(edge.from().r(), edge.to().r())
                    : Math.min(edge.from().q(), edge.to().q());
        }

        private static boolean sameOrientation(
                BoundaryStretchOrientation orientation,
                DungeonEditorWorkspaceValues.Edge edge
        ) {
            if (orientation == BoundaryStretchOrientation.HORIZONTAL) {
                return edge.from().r() == edge.to().r();
            }
            return edge.from().q() == edge.to().q();
        }

        private static List<DungeonEditorWorkspaceValues.Edge> contiguousRange(
                Map<Integer, DungeonEditorWorkspaceValues.Edge> edgesByVariable,
                int min,
                int max
        ) {
            List<DungeonEditorWorkspaceValues.Edge> contiguousEdges = new ArrayList<>();
            for (int variable = min; variable <= max; variable++) {
                DungeonEditorWorkspaceValues.Edge edge = edgesByVariable.get(variable);
                if (edge != null) {
                    contiguousEdges.add(edge);
                }
            }
            return List.copyOf(contiguousEdges);
        }
    }
}
