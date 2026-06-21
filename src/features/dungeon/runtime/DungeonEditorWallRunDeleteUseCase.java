package src.features.dungeon.runtime;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Edge;
import src.domain.dungeon.model.core.structure.room.RoomClusterWallMap;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues;
import src.features.dungeon.runtime.DungeonEditorInteractionValues.CellKey;
import src.features.dungeon.runtime.DungeonEditorInteractionValues.TravelHeading;
import src.features.dungeon.runtime.DungeonEditorInteractionValues.VertexKey;
import src.features.dungeon.runtime.DungeonEditorMainViewInteractionValues.EdgeKey;

final class DungeonEditorWallRunDeleteUseCase {
    private final DungeonEditorBoundaryClusterCellsHelper clusterCells =
            new DungeonEditorBoundaryClusterCellsHelper();
    private final DungeonEditorBoundaryEdgesHelper boundaryEdges = new DungeonEditorBoundaryEdgesHelper();

    WallDeleteTarget interiorRunForBoundary(
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            long clusterId,
            DungeonEditorWorkspaceValues.Edge edge
    ) {
        if (edge == null || edge.from() == null) {
            return WallDeleteTarget.none();
        }
        Set<EdgeKey> interiorWalls = wallEdges(snapshot, clusterId, edge.from().level(), true);
        EdgeKey target = EdgeKey.from(edge);
        if (interiorWalls.contains(target)) {
            return WallDeleteTarget.interior(clusterId, expandedWallDeleteEdges(interiorWalls, Set.of(target)));
        }
        Set<EdgeKey> clusterWalls = wallEdges(snapshot, clusterId, edge.from().level(), false);
        return clusterWalls.contains(target)
                ? WallDeleteTarget.protectedExterior(clusterId)
                : WallDeleteTarget.none();
    }

    WallDeleteTarget cornerRunDelete(
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            VertexKey vertex
    ) {
        for (Long clusterId : clusterCells.collect(snapshot, vertex.level()).keySet()) {
            Set<EdgeKey> interiorWalls = wallEdges(snapshot, clusterId, vertex.level(), true);
            Set<EdgeKey> interiorTargets = touchingEdges(interiorWalls, vertex);
            if (!interiorTargets.isEmpty()) {
                return WallDeleteTarget.interior(
                        clusterId,
                        expandedWallDeleteEdges(interiorWalls, interiorTargets));
            }
            if (!touchingEdges(wallEdges(snapshot, clusterId, vertex.level(), false), vertex).isEmpty()) {
                return WallDeleteTarget.protectedExterior(clusterId);
            }
        }
        return WallDeleteTarget.none();
    }

    WallDeleteTarget cellRunDelete(
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            CellKey cell
    ) {
        for (Long clusterId : clusterCells.collect(snapshot, cell.level()).keySet()) {
            Set<EdgeKey> interiorWalls = wallEdges(snapshot, clusterId, cell.level(), true);
            Set<EdgeKey> clusterWalls = wallEdges(snapshot, clusterId, cell.level(), false);
            for (TravelHeading direction : TravelHeading.values()) {
                EdgeKey candidate = EdgeKey.sideOf(cell, direction);
                if (interiorWalls.contains(candidate)) {
                    return WallDeleteTarget.interior(
                            clusterId,
                            expandedWallDeleteEdges(interiorWalls, Set.of(candidate)));
                }
                if (clusterWalls.contains(candidate)) {
                    return WallDeleteTarget.protectedExterior(clusterId);
                }
            }
        }
        return WallDeleteTarget.none();
    }

    Set<EdgeKey> cornerRunsForCluster(
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            long clusterId,
            VertexKey vertex
    ) {
        Set<EdgeKey> interiorWalls = wallEdges(snapshot, clusterId, vertex.level(), true);
        return expandedWallDeleteEdges(interiorWalls, touchingEdges(interiorWalls, vertex));
    }

    private Set<EdgeKey> wallEdges(
            DungeonEditorWorkspaceValues.MapSnapshot snapshot,
            long clusterId,
            int level,
            boolean internalOnly
    ) {
        Set<CellKey> cells = clusterCells.collect(snapshot, level).getOrDefault(clusterId, Set.of());
        return internalOnly
                ? boundaryEdges.existingWithinCells(
                        snapshot,
                        cells,
                        level,
                        DungeonEditorWorkspaceValues.BoundaryKind.WALL)
                : boundaryEdges.existingAlongClusterBoundary(
                        snapshot,
                        cells,
                        level,
                        DungeonEditorWorkspaceValues.BoundaryKind.WALL);
    }

    private static Set<EdgeKey> touchingEdges(Set<EdgeKey> walls, VertexKey vertex) {
        Set<EdgeKey> result = new LinkedHashSet<>();
        for (EdgeKey edge : walls) {
            if (edge.touches(vertex)) {
                result.add(edge);
            }
        }
        return Set.copyOf(result);
    }

    private static Set<EdgeKey> expandedWallDeleteEdges(Set<EdgeKey> authoredWalls, Set<EdgeKey> targets) {
        List<Edge> expanded = RoomClusterWallMap.authoredWallDeleteEdges(
                coreEdges(authoredWalls),
                coreEdges(targets));
        Set<EdgeKey> result = new LinkedHashSet<>();
        for (Edge edge : expanded) {
            result.add(runtimeEdge(edge));
        }
        return Set.copyOf(result);
    }

    private static List<Edge> coreEdges(Set<EdgeKey> edges) {
        List<Edge> result = new ArrayList<>();
        for (EdgeKey edge : edges) {
            result.add(coreEdge(edge));
        }
        return List.copyOf(result);
    }

    private static Edge coreEdge(EdgeKey edge) {
        return new Edge(
                new Cell(edge.start().q(), edge.start().r(), edge.start().level()),
                new Cell(edge.end().q(), edge.end().r(), edge.end().level()));
    }

    private static EdgeKey runtimeEdge(Edge edge) {
        return EdgeKey.between(
                new VertexKey(edge.from().q(), edge.from().r(), edge.from().level()),
                new VertexKey(edge.to().q(), edge.to().r(), edge.to().level()));
    }

    record WallDeleteTarget(long clusterId, Set<EdgeKey> edges, TargetKind kind) {
        WallDeleteTarget {
            edges = edges == null ? Set.of() : Set.copyOf(edges);
            kind = kind == null ? TargetKind.NONE : kind;
            clusterId = kind == TargetKind.NONE ? 0L : clusterId;
        }

        private static WallDeleteTarget interior(long clusterId, Set<EdgeKey> edges) {
            return new WallDeleteTarget(clusterId, edges, TargetKind.INTERIOR_RUN);
        }

        private static WallDeleteTarget protectedExterior(long clusterId) {
            return new WallDeleteTarget(clusterId, Set.of(), TargetKind.PROTECTED_EXTERIOR);
        }

        private static WallDeleteTarget none() {
            return new WallDeleteTarget(0L, Set.of(), TargetKind.NONE);
        }

        boolean protectedExterior() {
            return kind == TargetKind.PROTECTED_EXTERIOR;
        }
    }

    private enum TargetKind {
        INTERIOR_RUN,
        PROTECTED_EXTERIOR,
        NONE
    }
}
