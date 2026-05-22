package src.domain.dungeon.model.editor.helper;

import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorBoundaryTouchGeometry;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorMainViewInteractionValues;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorMainViewInteractionValues.BoundaryStretchSession;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorMainViewInteractionValues.BoundaryStretchSide;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorMainViewInteractionValues.BoundaryTarget;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorMainViewInteractionValues.PointerState;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionValues;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues;
import src.domain.dungeon.model.map.model.DungeonBoundaryStretchValueTypes.StretchOrientation;

public final class DungeonEditorBoundaryStretchHelper {
    public @Nullable BoundaryStretchSession start(
            PointerState input,
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            DungeonEditorSessionValues.Selection currentSelection
    ) {
        BoundaryTarget boundaryTarget = input == null ? null : input.boundaryTarget();
        if (input == null || !input.primaryButtonDown() || boundaryTarget == null || !boundaryTarget.present()) {
            return null;
        }
        StretchOrientation orientation = orientation(boundaryTarget);
        if (orientation == null) {
            return null;
        }
        long clusterId = resolveBoundaryClusterId(snapshot, boundaryTarget);
        if (!DungeonEditorWorkspaceValues.hasId(clusterId)) {
            return null;
        }
        List<DungeonEditorWorkspaceValues.Edge> sourceEdges =
                resolveBoundaryStretchEdges(snapshot, clusterId, boundaryTarget, orientation);
        if (sourceEdges.isEmpty()) {
            return null;
        }
        DungeonEditorSessionValues.Selection nextSelection =
                selectionForBoundaryStretch(snapshot, currentSelection, clusterId, boundaryTarget);
        return new BoundaryStretchSession(
                nextSelection,
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

    public List<DungeonEditorWorkspaceValues.Edge> resolveBoundaryStretchEdges(
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            long clusterId,
            BoundaryTarget boundaryTarget,
            StretchOrientation orientation
    ) {
        if (snapshot == null || !boundaryTarget.present()) {
            return List.of();
        }
        int level = boundaryTarget.start().level();
        if (!DungeonEditorWorkspaceValues.hasId(clusterId)) {
            return List.of();
        }
        Set<DungeonEditorWorkspaceValues.Cell> clusterCells = clusterCells(snapshot, clusterId, level);
        if (clusterCells.isEmpty()) {
            return List.of();
        }
        DungeonEditorWorkspaceValues.Edge clickedEdge = boundaryTarget.edgeRef();
        BoundaryStretchSide stretchSide = switch (
                DungeonEditorBoundaryTouchGeometry.fromEdge(clickedEdge).touchingCount(clusterCells)) {
            case 0 -> BoundaryStretchSide.NONE;
            case 1 -> BoundaryStretchSide.OUTER;
            default -> BoundaryStretchSide.INNER;
        };
        if (stretchSide == BoundaryStretchSide.NONE) {
            return List.of();
        }
        Map<Integer, DungeonEditorWorkspaceValues.Edge> edgesByVariable =
                edgesOnLine(snapshot, clusterCells, clickedEdge, orientation, stretchSide.outer());
        List<DungeonEditorWorkspaceValues.Edge> contiguousEdges =
                contiguousEdges(edgesByVariable, clickedEdge, orientation);
        return contiguousEdges.isEmpty() ? List.of(clickedEdge) : contiguousEdges;
    }

    private static List<DungeonEditorWorkspaceValues.Edge> contiguousEdges(
            Map<Integer, DungeonEditorWorkspaceValues.Edge> edgesByVariable,
            DungeonEditorWorkspaceValues.Edge clickedEdge,
            StretchOrientation orientation
    ) {
        int min = orientation == StretchOrientation.VERTICAL
                ? Math.min(clickedEdge.from().r(), clickedEdge.to().r())
                : Math.min(clickedEdge.from().q(), clickedEdge.to().q());
        int max = min;
        while (edgesByVariable.containsKey(min - 1)) {
            min--;
        }
        while (edgesByVariable.containsKey(max + 1)) {
            max++;
        }
        List<DungeonEditorWorkspaceValues.Edge> contiguousEdges = new ArrayList<>();
        for (int variable = min; variable <= max; variable++) {
            DungeonEditorWorkspaceValues.Edge edge = edgesByVariable.get(variable);
            if (edge != null) {
                contiguousEdges.add(edge);
            }
        }
        return List.copyOf(contiguousEdges);
    }

    private DungeonEditorSessionValues.Selection selectionForBoundaryStretch(
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            DungeonEditorSessionValues.Selection currentSelection,
            long clusterId,
            BoundaryTarget boundaryTarget
    ) {
        if (currentSelection != null && currentSelection.clusterSelection() && currentSelection.clusterId() == clusterId) {
            return currentSelection;
        }
        if (snapshot != null && clusterId > 0L) {
            for (DungeonEditorWorkspaceValues.Area area : snapshot.areas()) {
                if (area.kind().isRoom() && area.clusterId() == clusterId) {
                    return new DungeonEditorSessionValues.Selection(
                            area.topologyRef(),
                            area.clusterId(),
                            true,
                            DungeonEditorSessionValues.emptyHandleRef());
                }
            }
        }
        return new DungeonEditorSessionValues.Selection(
                new src.domain.dungeon.model.map.model.DungeonTopologyRef(
                        DungeonEditorMainViewInteractionValues.toTopologyKind(boundaryTarget.topologyRefKind()),
                        boundaryTarget.topologyRefId()),
                clusterId,
                true,
                DungeonEditorSessionValues.emptyHandleRef());
    }

    private static @Nullable StretchOrientation orientation(BoundaryTarget boundaryTarget) {
        if (boundaryTarget == null || !boundaryTarget.present()) {
            return null;
        }
        if (boundaryTarget.start().q() == boundaryTarget.end().q()) {
            return StretchOrientation.VERTICAL;
        }
        if (boundaryTarget.start().r() == boundaryTarget.end().r()) {
            return StretchOrientation.HORIZONTAL;
        }
        return null;
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
            if (!area.kind().isRoom() || area.clusterId() != clusterId) {
                continue;
            }
            for (DungeonEditorWorkspaceValues.Cell cell : area.cells()) {
                if (cell.level() == level) {
                    result.add(cell);
                }
            }
        }
        return Set.copyOf(result);
    }

    private static long resolveBoundaryClusterId(
            DungeonEditorWorkspaceValues.@Nullable MapSnapshot snapshot,
            BoundaryTarget boundaryTarget
    ) {
        if (snapshot == null || boundaryTarget == null || !boundaryTarget.present()) {
            return 0L;
        }
        List<DungeonEditorWorkspaceValues.Cell> touchingCells =
                DungeonEditorBoundaryTouchGeometry.fromEdge(boundaryTarget.edgeRef()).touchingCells();
        for (DungeonEditorWorkspaceValues.Area area : snapshot.areas()) {
            if (!area.kind().isRoom() || !DungeonEditorWorkspaceValues.hasId(area.clusterId())) {
                continue;
            }
            for (DungeonEditorWorkspaceValues.Cell cell : area.cells()) {
                if (touchingCells.contains(cell)) {
                    return area.clusterId();
                }
            }
        }
        return 0L;
    }

    private static Map<Integer, DungeonEditorWorkspaceValues.Edge> edgesOnLine(
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            Set<DungeonEditorWorkspaceValues.Cell> clusterCells,
            DungeonEditorWorkspaceValues.Edge clickedEdge,
            StretchOrientation orientation,
            boolean outer
    ) {
        Map<Integer, DungeonEditorWorkspaceValues.Edge> edgesByVariable = new LinkedHashMap<>();
        int level = clickedEdge.from().level();
        int fixedCoordinate = orientation == StretchOrientation.VERTICAL ? clickedEdge.from().q() : clickedEdge.from().r();
        for (DungeonEditorWorkspaceValues.Boundary boundary : snapshot.boundaries()) {
            DungeonEditorWorkspaceValues.Edge edge = boundary.edge();
            if (!matchesStretchLine(edge, clusterCells, level, orientation, fixedCoordinate, outer)) {
                continue;
            }
            int variableCoordinate = orientation == StretchOrientation.VERTICAL
                    ? Math.min(edge.from().r(), edge.to().r())
                    : Math.min(edge.from().q(), edge.to().q());
            edgesByVariable.put(variableCoordinate, edge);
        }
        return Map.copyOf(edgesByVariable);
    }

    private static boolean matchesStretchLine(
            DungeonEditorWorkspaceValues.Edge edge,
            Set<DungeonEditorWorkspaceValues.Cell> clusterCells,
            int level,
            StretchOrientation orientation,
            int fixedCoordinate,
            boolean outer
    ) {
        if (edge == null
                || edge.from() == null
                || edge.to() == null
                || edge.from().level() != level
                || edge.to().level() != level) {
            return false;
        }
        int edgeFixedCoordinate = orientation == StretchOrientation.VERTICAL ? edge.from().q() : edge.from().r();
        if (!sameOrientation(orientation, edge) || edgeFixedCoordinate != fixedCoordinate) {
            return false;
        }
        int touchCount = DungeonEditorBoundaryTouchGeometry.fromEdge(edge).touchingCount(clusterCells);
        boolean outerEdge = touchCount == 1;
        return touchCount > 0 && outerEdge == outer;
    }

    private static boolean sameOrientation(
            StretchOrientation orientation,
            DungeonEditorWorkspaceValues.Edge edge
    ) {
        if (orientation == StretchOrientation.HORIZONTAL) {
            return edge.from().r() == edge.to().r();
        }
        return edge.from().q() == edge.to().q();
    }
}
