package src.domain.dungeoneditor.interaction.service;

import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import src.domain.dungeoneditor.interaction.value.DungeonEditorMainViewInteractionValues.BoundaryStretchOrientation;
import src.domain.dungeoneditor.workspace.value.DungeonEditorWorkspaceValues;

public final class DungeonEditorBoundaryStretchLineCatalog {

    public Map<Integer, DungeonEditorWorkspaceValues.Edge> edgesOnLine(
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            Set<DungeonEditorWorkspaceValues.Cell> clusterCells,
            DungeonEditorWorkspaceValues.Edge clickedEdge,
            BoundaryStretchOrientation orientation,
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

    public int touchingClusterCount(
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

    private boolean matchesStretchLine(
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
                || fixedCoordinate(orientation, edge) != fixedCoordinate) {
            return false;
        }
        int touchCount = touchingClusterCount(edge, clusterCells);
        boolean outerEdge = touchCount == 1;
        return touchCount > 0 && outerEdge == outer;
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
            BoundaryStretchOrientation orientation,
            DungeonEditorWorkspaceValues.Edge edge
    ) {
        return switch (orientation) {
            case HORIZONTAL -> edge.from().r() == edge.to().r();
            case VERTICAL -> edge.from().q() == edge.to().q();
        };
    }

    private static int fixedCoordinate(
            BoundaryStretchOrientation orientation,
            DungeonEditorWorkspaceValues.Edge edge
    ) {
        return orientation == BoundaryStretchOrientation.VERTICAL ? edge.from().q() : edge.from().r();
    }

    private static int variableCoordinate(
            BoundaryStretchOrientation orientation,
            DungeonEditorWorkspaceValues.Edge edge
    ) {
        return orientation == BoundaryStretchOrientation.VERTICAL
                ? Math.min(edge.from().r(), edge.to().r())
                : Math.min(edge.from().q(), edge.to().q());
    }
}
