package features.dungeon.domain.core.structure.room;

import features.dungeon.domain.core.component.boundary.BoundaryKind;
import features.dungeon.domain.core.component.boundary.BoundarySegment;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.DungeonBoundaryTouch;
import features.dungeon.domain.core.geometry.Edge;
import features.dungeon.domain.core.graph.DungeonTopologyRef;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.jspecify.annotations.Nullable;

final class RoomClusterBoundaryGeometry {

    Map<Integer, List<BoundarySegment>> filterBoundaries(
            Iterable<BoundarySegment> boundaries,
            Map<Integer, List<Cell>> cellsByLevel
    ) {
        Map<Integer, List<BoundarySegment>> result = new LinkedHashMap<>();
        for (BoundarySegment boundary : boundaries == null ? List.<BoundarySegment>of() : boundaries) {
            Set<Cell> levelCells = new LinkedHashSet<>(cellsByLevel.getOrDefault(boundary.level(), List.of()));
            if (touch(boundary.edge(), levelCells).touchesCluster()) {
                result.computeIfAbsent(boundary.level(), ignored -> new ArrayList<>()).add(boundary);
            }
        }
        Map<Integer, List<BoundarySegment>> immutable = new LinkedHashMap<>();
        result.forEach((level, levelBoundaries) -> immutable.put(level, List.copyOf(levelBoundaries)));
        return Map.copyOf(immutable);
    }

    @Nullable BoundarySegment boundaryForEdge(
            Set<Cell> clusterCells,
            Edge edge,
            BoundaryKind kind,
            @Nullable DungeonTopologyRef topologyRef
    ) {
        return touchingClusterCells(clusterCells, edge).isEmpty()
                ? null
                : BoundarySegment.fromEdge(edge, kind, topologyRef);
    }

    @Nullable BoundarySegment openBoundaryForEdge(Set<Cell> clusterCells, Edge edge) {
        Set<Cell> touchingCells = touchingClusterCells(clusterCells, edge);
        return touchingCells.size() == 1
                ? BoundarySegment.fromEdge(edge, BoundaryKind.OPEN, DungeonTopologyRef.empty())
                : null;
    }

    private static DungeonBoundaryTouch touch(Edge edge, Set<Cell> clusterCells) {
        return new DungeonBoundaryTouch(edge.touchingCells().stream().filter(clusterCells::contains).toList());
    }

    private static Set<Cell> touchingClusterCells(Set<Cell> clusterCells, @Nullable Edge edge) {
        Set<Cell> result = new LinkedHashSet<>();
        for (Cell cell : edge == null ? Set.<Cell>of() : edge.touchingCells()) {
            if (clusterCells != null && clusterCells.contains(cell)) {
                result.add(cell);
            }
        }
        return Set.copyOf(result);
    }
}
