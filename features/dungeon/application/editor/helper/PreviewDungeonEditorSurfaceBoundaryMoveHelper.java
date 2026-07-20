package features.dungeon.application.editor.helper;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceGeometry;
import features.dungeon.domain.core.geometry.EdgeKey;
import features.dungeon.domain.core.geometry.DungeonBoundaryKey;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.Boundary;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Edge;
import features.dungeon.domain.core.graph.DungeonTopologyRef;

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
        Set<Cell> stationaryEndpoints = new LinkedHashSet<>();
        List<Boundary> movedSources = new ArrayList<>();
        for (Boundary boundary : boundaries) {
            if (sourceEdgeKeys.contains(EdgeKey.from(boundary.edge()))) {
                Boundary moved = movedBoundary(boundary, deltaQ, deltaR, deltaLevel);
                result.add(moved);
                movedSources.add(boundary);
            } else {
                result.add(boundary);
                stationaryEndpoints.add(boundary.edge().from());
                stationaryEndpoints.add(boundary.edge().to());
            }
        }
        Map<EdgeKey, Boundary> connectors = new LinkedHashMap<>();
        for (Boundary source : movedSources) {
            addConnector(connectors, source, source.edge().from(), stationaryEndpoints,
                    deltaQ, deltaR, deltaLevel);
            addConnector(connectors, source, source.edge().to(), stationaryEndpoints,
                    deltaQ, deltaR, deltaLevel);
        }
        result.addAll(connectors.values());
        return List.copyOf(result);
    }

    private static void addConnector(
            Map<EdgeKey, Boundary> connectors,
            Boundary source,
            Cell sharedEndpoint,
            Set<Cell> stationaryEndpoints,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        if (!stationaryEndpoints.contains(sharedEndpoint)) {
            return;
        }
        Cell movedEndpoint = new Cell(
                sharedEndpoint.q() + deltaQ,
                sharedEndpoint.r() + deltaR,
                sharedEndpoint.level() + deltaLevel);
        if (movedEndpoint.equals(sharedEndpoint)) {
            return;
        }
        for (Edge connector : DungeonEditorWorkspaceGeometry.unitEdges(
                List.of(new Edge(movedEndpoint, sharedEndpoint)))) {
            connectors.putIfAbsent(
                    EdgeKey.from(connector),
                    new Boundary(
                            source.kind(),
                            DungeonBoundaryKey.from(connector).stableId(),
                            source.label(),
                            connector,
                            DungeonTopologyRef.empty()));
        }
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
