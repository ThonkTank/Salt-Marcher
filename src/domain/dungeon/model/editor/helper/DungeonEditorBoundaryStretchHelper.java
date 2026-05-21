package src.domain.dungeon.model.editor.helper;

import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.jspecify.annotations.Nullable;
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
        Set<DungeonEditorWorkspaceValues.Cell> clusterCells = clusterCells(snapshot, clusterId, level);
        if (clusterCells.isEmpty()) {
            return List.of();
        }
        DungeonEditorWorkspaceValues.Edge clickedEdge = boundaryTarget.edgeRef();
        BoundaryStretchSide stretchSide = outerStretch(clickedEdge, clusterCells);
        if (stretchSide == BoundaryStretchSide.NONE) {
            return List.of();
        }
        Map<Integer, DungeonEditorWorkspaceValues.Edge> edgesByVariable =
                edgesOnLine(snapshot, clusterCells, clickedEdge, orientation, stretchSide.outer());
        List<DungeonEditorWorkspaceValues.Edge> contiguousEdges =
                contiguousEdges(edgesByVariable, clickedEdge, orientation);
        return contiguousEdges.isEmpty() ? List.of(clickedEdge) : contiguousEdges;
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
        DungeonEditorWorkspaceValues.Area clusterArea = firstClusterArea(snapshot, clusterId);
        if (clusterArea != null) {
            return new DungeonEditorSessionValues.Selection(
                    clusterArea.topologyRef(),
                    clusterArea.clusterId(),
                    true,
                    DungeonEditorSessionValues.emptyHandleRef());
        }
        return new DungeonEditorSessionValues.Selection(
                new src.domain.dungeon.model.map.model.DungeonTopologyRef(
                        DungeonEditorMainViewInteractionValues.toTopologyKind(boundaryTarget.topologyRefKind()),
                        boundaryTarget.topologyRefId()),
                clusterId,
                true,
                DungeonEditorSessionValues.emptyHandleRef());
    }

    private DungeonEditorWorkspaceValues.@Nullable Area firstClusterArea(
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            long clusterId
    ) {
        if (snapshot == null || clusterId <= 0L) {
            return null;
        }
        for (DungeonEditorWorkspaceValues.Area area : snapshot.areas()) {
            if (area.kind().isRoom() && area.clusterId() == clusterId) {
                return area;
            }
        }
        return null;
    }

    private BoundaryStretchSide outerStretch(
            DungeonEditorWorkspaceValues.Edge clickedEdge,
            Set<DungeonEditorWorkspaceValues.Cell> clusterCells
    ) {
        int clickedTouchCount = touchingClusterCount(clickedEdge, clusterCells);
        if (clickedTouchCount == 0) {
            return BoundaryStretchSide.NONE;
        }
        return clickedTouchCount == 1 ? BoundaryStretchSide.OUTER : BoundaryStretchSide.INNER;
    }

    private static List<DungeonEditorWorkspaceValues.Edge> contiguousEdges(
            Map<Integer, DungeonEditorWorkspaceValues.Edge> edgesByVariable,
            DungeonEditorWorkspaceValues.Edge clickedEdge,
            StretchOrientation orientation
    ) {
        int min = variableCoordinate(orientation, clickedEdge);
        int max = min;
        while (edgesByVariable.containsKey(min - 1)) {
            min--;
        }
        while (edgesByVariable.containsKey(max + 1)) {
            max++;
        }
        List<DungeonEditorWorkspaceValues.Edge> result = new ArrayList<>();
        for (int variable = min; variable <= max; variable++) {
            DungeonEditorWorkspaceValues.Edge edge = edgesByVariable.get(variable);
            if (edge != null) {
                result.add(edge);
            }
        }
        return List.copyOf(result);
    }

    private static int variableCoordinate(
            StretchOrientation orientation,
            DungeonEditorWorkspaceValues.Edge edge
    ) {
        return orientation == StretchOrientation.VERTICAL
                ? Math.min(edge.from().r(), edge.to().r())
                : Math.min(edge.from().q(), edge.to().q());
    }

    private static int fixedCoordinate(
            StretchOrientation orientation,
            DungeonEditorWorkspaceValues.Edge edge
    ) {
        return orientation == StretchOrientation.VERTICAL ? edge.from().q() : edge.from().r();
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
        List<DungeonEditorWorkspaceValues.Cell> touchingCells = touchingCells(
                boundaryTarget.start().toWorkspaceCell(),
                boundaryTarget.end().toWorkspaceCell());
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

    private static List<DungeonEditorWorkspaceValues.Cell> touchingCells(
            DungeonEditorWorkspaceValues.Cell start,
            DungeonEditorWorkspaceValues.Cell end
    ) {
        if (start.level() != end.level()) {
            return List.of();
        }
        List<DungeonEditorWorkspaceValues.Cell> result = new ArrayList<>();
        if (start.r() == end.r()) {
            for (int q = Math.min(start.q(), end.q()); q < Math.max(start.q(), end.q()); q++) {
                result.add(new DungeonEditorWorkspaceValues.Cell(q, start.r() - 1, start.level()));
                result.add(new DungeonEditorWorkspaceValues.Cell(q, start.r(), start.level()));
            }
        } else if (start.q() == end.q()) {
            for (int r = Math.min(start.r(), end.r()); r < Math.max(start.r(), end.r()); r++) {
                result.add(new DungeonEditorWorkspaceValues.Cell(start.q() - 1, r, start.level()));
                result.add(new DungeonEditorWorkspaceValues.Cell(start.q(), r, start.level()));
            }
        }
        return List.copyOf(result);
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
        int fixedCoordinate = fixedCoordinate(orientation, clickedEdge);
        for (DungeonEditorWorkspaceValues.Boundary boundary : snapshot.boundaries()) {
            DungeonEditorWorkspaceValues.Edge edge = boundary.edge();
            if (!matchesStretchLine(edge, clusterCells, level, orientation, fixedCoordinate, outer)) {
                continue;
            }
            edgesByVariable.put(variableCoordinate(orientation, edge), edge);
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
                || edge.to().level() != level
                || !sameOrientation(orientation, edge)
                || fixedCoordinate(orientation, edge) != fixedCoordinate) {
            return false;
        }
        int touchCount = touchingClusterCount(edge, clusterCells);
        boolean outerEdge = touchCount == 1;
        return touchCount > 0 && outerEdge == outer;
    }

    private static int touchingClusterCount(
            DungeonEditorWorkspaceValues.Edge edge,
            Set<DungeonEditorWorkspaceValues.Cell> clusterCells
    ) {
        if (edge == null || edge.from() == null || edge.to() == null || edge.from().level() != edge.to().level()) {
            return 0;
        }
        if (edge.from().r() == edge.to().r()) {
            return horizontalTouchingClusterCount(edge.from(), edge.to(), clusterCells);
        }
        if (edge.from().q() == edge.to().q()) {
            return verticalTouchingClusterCount(edge.from(), edge.to(), clusterCells);
        }
        return 0;
    }

    private static int horizontalTouchingClusterCount(
            DungeonEditorWorkspaceValues.Cell from,
            DungeonEditorWorkspaceValues.Cell to,
            Set<DungeonEditorWorkspaceValues.Cell> clusterCells
    ) {
        int count = 0;
        for (int q = Math.min(from.q(), to.q()); q < Math.max(from.q(), to.q()); q++) {
            if (clusterCells.contains(new DungeonEditorWorkspaceValues.Cell(q, from.r() - 1, from.level()))) {
                count++;
            }
            if (clusterCells.contains(new DungeonEditorWorkspaceValues.Cell(q, from.r(), from.level()))) {
                count++;
            }
        }
        return count;
    }

    private static int verticalTouchingClusterCount(
            DungeonEditorWorkspaceValues.Cell from,
            DungeonEditorWorkspaceValues.Cell to,
            Set<DungeonEditorWorkspaceValues.Cell> clusterCells
    ) {
        int count = 0;
        for (int r = Math.min(from.r(), to.r()); r < Math.max(from.r(), to.r()); r++) {
            if (clusterCells.contains(new DungeonEditorWorkspaceValues.Cell(from.q() - 1, r, from.level()))) {
                count++;
            }
            if (clusterCells.contains(new DungeonEditorWorkspaceValues.Cell(from.q(), r, from.level()))) {
                count++;
            }
        }
        return count;
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
