package src.domain.dungeon.model.runtime.helper;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceGeometry;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceGeometry.EdgeKey;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.Boundary;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.Cell;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.Edge;

public final class PreviewDungeonEditorSurfaceBoundaryMoveHelper {

    public List<Boundary> movedClusterBoundaries(
            List<Boundary> boundaries,
            Set<Cell> clusterCells,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        if (clusterCells.isEmpty()) {
            return boundaries;
        }
        List<Boundary> result = new ArrayList<>();
        for (Boundary boundary : boundaries) {
            result.add(touchesClusterFloor(boundary.edge(), clusterCells)
                    ? movedBoundary(boundary, deltaQ, deltaR, deltaLevel)
                    : boundary);
        }
        return List.copyOf(result);
    }

    public List<Boundary> movedCornerBoundaries(
            List<Boundary> boundaries,
            Cell source,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        List<Boundary> result = new ArrayList<>();
        for (Boundary boundary : boundaries) {
            result.add(DungeonEditorWorkspaceGeometry.edgeHasCell(boundary.edge(), source)
                    ? boundaryWithEdge(
                            boundary,
                            DungeonEditorWorkspaceGeometry.movedMatchingCell(
                                    boundary.edge(),
                                    source,
                                    deltaQ,
                                    deltaR,
                                    deltaLevel))
                    : boundary);
        }
        return List.copyOf(result);
    }

    public List<Boundary> movedSourceEdgeBoundaries(
            List<Boundary> boundaries,
            List<Edge> sourceEdges,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        Set<EdgeKey> sourceEdgeKeys = DungeonEditorWorkspaceGeometry.unitEdgeKeys(sourceEdges);
        List<Boundary> result = new ArrayList<>();
        for (Boundary boundary : boundaries) {
            result.add(sourceEdgeKeys.contains(EdgeKey.of(boundary.edge()))
                    ? movedBoundary(boundary, deltaQ, deltaR, deltaLevel)
                    : boundary);
        }
        return List.copyOf(result);
    }

    private static boolean touchesClusterFloor(Edge edge, Set<Cell> clusterCells) {
        for (Cell adjacent : DungeonEditorWorkspaceGeometry.adjacentFloorCells(edge)) {
            if (clusterCells.contains(adjacent)) {
                return true;
            }
        }
        return false;
    }

    private static Boundary movedBoundary(Boundary boundary, int deltaQ, int deltaR, int deltaLevel) {
        return boundaryWithEdge(
                boundary,
                DungeonEditorWorkspaceGeometry.movedEdge(boundary.edge(), deltaQ, deltaR, deltaLevel));
    }

    private static Boundary boundaryWithEdge(Boundary boundary, Edge edge) {
        return new Boundary(boundary.kind(), boundary.id(), boundary.label(), edge, boundary.topologyRef());
    }
}
