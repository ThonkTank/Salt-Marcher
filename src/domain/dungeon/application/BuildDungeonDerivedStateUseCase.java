package src.domain.dungeon.application;

import src.domain.dungeon.map.aggregate.DungeonMap;
import src.domain.dungeon.map.entity.DungeonAggregate;
import src.domain.dungeon.map.entity.DungeonPrimitive;
import src.domain.dungeon.map.entity.DungeonRoom;
import src.domain.dungeon.map.entity.DungeonRoomCluster;
import src.domain.dungeon.map.value.DungeonAreaFacts;
import src.domain.dungeon.map.value.DungeonAreaType;
import src.domain.dungeon.map.value.DungeonBoundaryFacts;
import src.domain.dungeon.map.value.DungeonCell;
import src.domain.dungeon.map.value.DungeonClusterBoundary;
import src.domain.dungeon.map.value.DungeonClusterBoundaryKind;
import src.domain.dungeon.map.value.DungeonDerivedState;
import src.domain.dungeon.map.value.DungeonEdge;
import src.domain.dungeon.map.value.DungeonMapFacts;
import src.domain.dungeon.map.value.DungeonRelationGraph;
import src.domain.dungeon.map.value.SpatialTopology;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Rebuilds render and lookup state from committed dungeon truth.
 */
public final class BuildDungeonDerivedStateUseCase {

    private static final String DOOR_KIND = "door";
    private static final DungeonCell LOOP_SEPARATOR = new DungeonCell(Integer.MIN_VALUE, Integer.MIN_VALUE, 0);

    public DungeonDerivedState execute(DungeonMap dungeonMap) {
        SpatialTopology topology = dungeonMap == null ? SpatialTopology.demo() : dungeonMap.topology();
        if (dungeonMap != null && !dungeonMap.rooms().rooms().isEmpty() && topology.hasAuthoredRooms()) {
            return authoredState(dungeonMap, topology);
        }
        return demoState(topology);
    }

    private DungeonDerivedState authoredState(DungeonMap dungeonMap, SpatialTopology topology) {
        List<DungeonAggregate> aggregates = new ArrayList<>();
        List<DungeonPrimitive> primitives = new ArrayList<>();
        List<DungeonAreaFacts> areas = new ArrayList<>();
        List<DungeonBoundaryFacts> boundaries = new ArrayList<>();
        List<DungeonRelationGraph.ContainmentRelation> containment = new ArrayList<>();
        List<DungeonRelationGraph.ConnectionRelation> connections = new ArrayList<>();
        Map<Long, List<DungeonRoom>> roomsByCluster = roomsByCluster(dungeonMap.rooms().rooms());
        long primitiveId = 1_000L;

        for (DungeonRoomCluster cluster : topology.roomClusters()) {
            List<DungeonRoom> clusterRooms = roomsByCluster.getOrDefault(cluster.clusterId(), List.of());
            Map<Long, List<DungeonCell>> roomCells = hydrateCluster(cluster, clusterRooms);
            for (DungeonRoom room : clusterRooms) {
                List<DungeonCell> cells = roomCells.getOrDefault(room.roomId(), List.of(room.primaryAnchor()));
                DungeonAggregate aggregate = new DungeonAggregate(room.roomId(), DungeonAreaType.ROOM, room.name(), cells);
                aggregates.add(aggregate);
                areas.add(new DungeonAreaFacts(aggregate.kind(), aggregate.id(), aggregate.label(), aggregate.cells()));
            }

            Set<BoundaryKey> seenBoundaries = new LinkedHashSet<>();
            for (List<DungeonClusterBoundary> levelBoundaries : cluster.boundariesByLevel().values()) {
                for (DungeonClusterBoundary boundary : levelBoundaries) {
                    primitiveId = addBoundary(
                            cluster,
                            boundary,
                            primitiveId,
                            roomCells,
                            seenBoundaries,
                            primitives,
                            boundaries,
                            containment,
                            connections);
                }
            }
            for (DungeonRoom room : clusterRooms) {
                for (DungeonCell cell : roomCells.getOrDefault(room.roomId(), List.of())) {
                    for (DirectionStep step : DirectionStep.CARDINAL) {
                        DungeonCell neighbor = step.neighbor(cell);
                        if (containsAnyRoomCell(roomCells, neighbor)) {
                            continue;
                        }
                        DungeonClusterBoundary perimeter = new DungeonClusterBoundary(
                                cluster.clusterId(),
                                cell.level(),
                                new DungeonCell(cell.q() - cluster.center().q(), cell.r() - cluster.center().r(), cell.level()),
                                step.direction(),
                                DungeonClusterBoundaryKind.WALL);
                        primitiveId = addBoundary(
                                cluster,
                                perimeter,
                                primitiveId,
                                roomCells,
                                seenBoundaries,
                                primitives,
                                boundaries,
                                containment,
                                connections);
                    }
                }
            }
        }

        DungeonMapFacts map = new DungeonMapFacts(
                topology.topology(),
                topology.width(),
                topology.height(),
                areas,
                boundaries);
        return new DungeonDerivedState(
                map,
                aggregates,
                primitives,
                new DungeonRelationGraph(containment, connections));
    }

    private static long addBoundary(
            DungeonRoomCluster cluster,
            DungeonClusterBoundary boundary,
            long primitiveId,
            Map<Long, List<DungeonCell>> roomCells,
            Set<BoundaryKey> seenBoundaries,
            List<DungeonPrimitive> primitives,
            List<DungeonBoundaryFacts> boundaries,
            List<DungeonRelationGraph.ContainmentRelation> containment,
            List<DungeonRelationGraph.ConnectionRelation> connections
    ) {
        BoundaryKey key = BoundaryKey.from(boundary.absoluteEdge(cluster.center()));
        if (!seenBoundaries.add(key)) {
            return primitiveId;
        }
        long nextPrimitiveId = primitiveId + 1L;
        String kind = boundary.kind().primitiveKind();
        String label = boundary.kind() == DungeonClusterBoundaryKind.DOOR ? "Door" : "Wall";
        DungeonEdge edge = boundary.absoluteEdge(cluster.center());
        DungeonPrimitive primitive = new DungeonPrimitive(primitiveId, kind, label, edge);
        primitives.add(primitive);
        boundaries.add(new DungeonBoundaryFacts(kind, primitive.id(), primitive.label(), primitive.edge()));

        List<Long> touchingRoomIds = touchingRoomIds(edge, roomCells);
        for (Long roomId : touchingRoomIds) {
            containment.add(new DungeonRelationGraph.ContainmentRelation(roomId, primitive.id(), kind));
        }
        if (boundary.kind() == DungeonClusterBoundaryKind.DOOR && touchingRoomIds.size() >= 2) {
            connections.add(new DungeonRelationGraph.ConnectionRelation(
                    touchingRoomIds.getFirst(),
                    touchingRoomIds.get(1),
                    DOOR_KIND));
        }
        return nextPrimitiveId;
    }

    private static Map<Long, List<DungeonCell>> hydrateCluster(
            DungeonRoomCluster cluster,
            List<DungeonRoom> rooms
    ) {
        Map<Long, List<DungeonCell>> result = new LinkedHashMap<>();
        Set<Integer> levels = levels(cluster, rooms);
        for (Integer level : levels) {
            Set<DungeonCell> clusterCells = new LinkedHashSet<>(clusterCells(cluster, rooms, level));
            Set<DungeonCell> unclaimedCells = new LinkedHashSet<>(clusterCells);
            List<DungeonClusterBoundary> barriers = cluster.boundariesByLevel().getOrDefault(level, List.of());
            for (DungeonRoom room : rooms) {
                DungeonCell anchor = room.floorAnchors().get(level);
                if (anchor == null) {
                    continue;
                }
                if (!clusterCells.contains(anchor)) {
                    clusterCells.add(anchor);
                    unclaimedCells.add(anchor);
                } else if (!unclaimedCells.contains(anchor)) {
                    result.computeIfAbsent(room.roomId(), ignored -> new ArrayList<>()).add(anchor);
                    continue;
                }
                Set<DungeonCell> reachable = reachableCells(anchor, unclaimedCells, barriers, cluster.center());
                if (reachable.isEmpty()) {
                    reachable = Set.of(anchor);
                }
                unclaimedCells.removeAll(reachable);
                result.computeIfAbsent(room.roomId(), ignored -> new ArrayList<>()).addAll(reachable);
            }
        }
        for (DungeonRoom room : rooms) {
            result.computeIfAbsent(room.roomId(), ignored -> new ArrayList<>()).add(room.primaryAnchor());
        }
        Map<Long, List<DungeonCell>> normalized = new LinkedHashMap<>();
        for (Map.Entry<Long, List<DungeonCell>> entry : result.entrySet()) {
            normalized.put(entry.getKey(), entry.getValue().stream()
                    .distinct()
                    .sorted(Comparator
                            .comparingInt(DungeonCell::level)
                            .thenComparingInt(DungeonCell::r)
                            .thenComparingInt(DungeonCell::q))
                    .toList());
        }
        return Map.copyOf(normalized);
    }

    private static Set<Integer> levels(DungeonRoomCluster cluster, List<DungeonRoom> rooms) {
        Set<Integer> levels = new LinkedHashSet<>();
        levels.add(cluster.center().level());
        levels.addAll(cluster.relativeVerticesByLevel().keySet());
        levels.addAll(cluster.boundariesByLevel().keySet());
        for (DungeonRoom room : rooms) {
            levels.addAll(room.floorAnchors().keySet());
        }
        return levels;
    }

    private static Set<DungeonCell> clusterCells(DungeonRoomCluster cluster, List<DungeonRoom> rooms, int level) {
        List<DungeonCell> vertices = cluster.relativeVerticesByLevel().getOrDefault(level, List.of());
        if (!vertices.isEmpty()) {
            return cellsFromRelativeVertices(cluster.center(), level, vertices);
        }
        Set<DungeonCell> anchors = new LinkedHashSet<>();
        for (DungeonRoom room : rooms) {
            DungeonCell anchor = room.floorAnchors().get(level);
            if (anchor != null) {
                anchors.add(anchor);
            }
        }
        if (anchors.isEmpty()) {
            anchors.add(new DungeonCell(cluster.center().q(), cluster.center().r(), level));
        }
        return anchors;
    }

    private static Set<DungeonCell> cellsFromRelativeVertices(
            DungeonCell center,
            int level,
            List<DungeonCell> relativeVertices
    ) {
        List<List<DungeonCell>> loops = splitLoops(relativeVertices);
        if (loops.isEmpty()) {
            return Set.of(new DungeonCell(center.q(), center.r(), level));
        }
        int minQ = loops.stream().flatMap(List::stream).mapToInt(DungeonCell::q).min().orElse(0);
        int maxQ = loops.stream().flatMap(List::stream).mapToInt(DungeonCell::q).max().orElse(0);
        int minR = loops.stream().flatMap(List::stream).mapToInt(DungeonCell::r).min().orElse(0);
        int maxR = loops.stream().flatMap(List::stream).mapToInt(DungeonCell::r).max().orElse(0);
        Set<DungeonCell> cells = new LinkedHashSet<>();
        for (int q = minQ; q <= maxQ; q++) {
            for (int r = minR; r <= maxR; r++) {
                if (containsCell(loops, q, r)) {
                    cells.add(new DungeonCell(center.q() + q, center.r() + r, level));
                }
            }
        }
        return cells.isEmpty() ? Set.of(new DungeonCell(center.q(), center.r(), level)) : cells;
    }

    private static List<List<DungeonCell>> splitLoops(List<DungeonCell> vertices) {
        List<List<DungeonCell>> loops = new ArrayList<>();
        List<DungeonCell> currentLoop = new ArrayList<>();
        for (DungeonCell vertex : vertices == null ? List.<DungeonCell>of() : vertices) {
            if (LOOP_SEPARATOR.equals(vertex)) {
                if (!currentLoop.isEmpty()) {
                    loops.add(List.copyOf(currentLoop));
                    currentLoop = new ArrayList<>();
                }
                continue;
            }
            currentLoop.add(vertex);
        }
        if (!currentLoop.isEmpty()) {
            loops.add(List.copyOf(currentLoop));
        }
        return List.copyOf(loops);
    }

    private static boolean containsCell(List<List<DungeonCell>> loops, int q, int r) {
        boolean inside = false;
        for (List<DungeonCell> loop : loops) {
            if (polygonContainsCell(loop, q, r)) {
                inside = !inside;
            }
        }
        return inside;
    }

    private static boolean polygonContainsCell(List<DungeonCell> polygon, int q, int r) {
        double px = q + 0.5D;
        double py = r + 0.5D;
        boolean inside = false;
        for (int i = 0, j = polygon.size() - 1; i < polygon.size(); j = i++) {
            DungeonCell pi = polygon.get(i);
            DungeonCell pj = polygon.get(j);
            boolean intersects = ((pi.r() > py) != (pj.r() > py))
                    && (px < (double) (pj.q() - pi.q()) * (py - pi.r()) / (double) (pj.r() - pi.r()) + pi.q());
            if (intersects) {
                inside = !inside;
            }
        }
        return inside;
    }

    private static Set<DungeonCell> reachableCells(
            DungeonCell anchor,
            Set<DungeonCell> traversableCells,
            List<DungeonClusterBoundary> barriers,
            DungeonCell center
    ) {
        Set<DungeonCell> visited = new LinkedHashSet<>();
        Set<DungeonCell> frontier = new LinkedHashSet<>(traversableCells);
        ArrayDeque<DungeonCell> queue = new ArrayDeque<>();
        queue.add(anchor);
        frontier.remove(anchor);
        while (!queue.isEmpty()) {
            DungeonCell current = queue.removeFirst();
            visited.add(current);
            for (DirectionStep step : DirectionStep.CARDINAL) {
                DungeonCell neighbor = step.neighbor(current);
                if (!frontier.contains(neighbor) || isBlocked(barriers, center, current, step)) {
                    continue;
                }
                frontier.remove(neighbor);
                queue.addLast(neighbor);
            }
        }
        return Set.copyOf(visited);
    }

    private static boolean isBlocked(
            List<DungeonClusterBoundary> barriers,
            DungeonCell center,
            DungeonCell cell,
            DirectionStep step
    ) {
        for (DungeonClusterBoundary barrier : barriers) {
            if (crosses(barrier, center, cell, step)) {
                return true;
            }
        }
        return false;
    }

    private static boolean crosses(
            DungeonClusterBoundary boundary,
            DungeonCell center,
            DungeonCell cell,
            DirectionStep step
    ) {
        DungeonCell from = boundary.absoluteCell(center);
        DungeonCell to = boundary.direction().neighborOf(from);
        DungeonCell neighbor = step.neighbor(cell);
        return (from.equals(cell) && to.equals(neighbor)) || (from.equals(neighbor) && to.equals(cell));
    }

    private static boolean containsAnyRoomCell(Map<Long, List<DungeonCell>> cellsByRoom, DungeonCell cell) {
        for (List<DungeonCell> cells : cellsByRoom.values()) {
            if (cells.contains(cell)) {
                return true;
            }
        }
        return false;
    }

    private static List<Long> touchingRoomIds(DungeonEdge edge, Map<Long, List<DungeonCell>> cellsByRoom) {
        List<Long> result = new ArrayList<>();
        for (Map.Entry<Long, List<DungeonCell>> entry : cellsByRoom.entrySet()) {
            if (entry.getValue().contains(edge.from()) || entry.getValue().contains(edge.to())) {
                result.add(entry.getKey());
            }
        }
        return List.copyOf(result);
    }

    private static Map<Long, List<DungeonRoom>> roomsByCluster(List<DungeonRoom> rooms) {
        Map<Long, List<DungeonRoom>> result = new LinkedHashMap<>();
        for (DungeonRoom room : rooms) {
            result.computeIfAbsent(room.clusterId(), ignored -> new ArrayList<>()).add(room);
        }
        return Map.copyOf(result);
    }

    private DungeonDerivedState demoState(SpatialTopology topology) {
        List<DungeonCell> roomCells = buildRoomCells(topology);
        List<DungeonCell> corridorCells = buildCorridorCells(topology);
        DungeonAggregate room = new DungeonAggregate(1L, DungeonAreaType.ROOM, "Entry Hall", roomCells);
        DungeonAggregate corridor = new DungeonAggregate(2L, DungeonAreaType.CORRIDOR, "South Corridor", corridorCells);
        DungeonPrimitive door = new DungeonPrimitive(
                100L,
                DOOR_KIND,
                "Oak Door",
                new DungeonEdge(roomCells.get(3), corridorCells.getFirst()));

        List<DungeonPrimitive> walls = List.of(
                new DungeonPrimitive(200L, "wall", "North Wall", new DungeonEdge(roomCells.getFirst(), roomCells.get(1))),
                new DungeonPrimitive(201L, "wall", "South Wall", new DungeonEdge(roomCells.get(2), roomCells.get(3)))
        );

        DungeonRelationGraph relations = new DungeonRelationGraph(
                List.of(
                        new DungeonRelationGraph.ContainmentRelation(room.id(), door.id(), DOOR_KIND),
                        new DungeonRelationGraph.ContainmentRelation(corridor.id(), door.id(), DOOR_KIND)
                ),
                List.of(
                        new DungeonRelationGraph.ConnectionRelation(corridor.id(), room.id(), "south")
                )
        );

        DungeonMapFacts map = new DungeonMapFacts(
                topology.topology(),
                topology.width(),
                topology.height(),
                List.of(
                        new DungeonAreaFacts(room.kind(), room.id(), room.label(), room.cells()),
                        new DungeonAreaFacts(corridor.kind(), corridor.id(), corridor.label(), corridor.cells())
                ),
                List.of(
                        new DungeonBoundaryFacts(door.kind(), door.id(), door.label(), door.edge()),
                        new DungeonBoundaryFacts(walls.getFirst().kind(), walls.getFirst().id(), walls.getFirst().label(), walls.getFirst().edge()),
                        new DungeonBoundaryFacts(walls.get(1).kind(), walls.get(1).id(), walls.get(1).label(), walls.get(1).edge())
                )
        );

        List<DungeonPrimitive> primitives = new ArrayList<>();
        primitives.add(door);
        primitives.addAll(walls);
        return new DungeonDerivedState(map, List.of(room, corridor), primitives, relations);
    }

    private List<DungeonCell> buildRoomCells(SpatialTopology topology) {
        List<DungeonCell> cells = new ArrayList<>();
        for (int r = 0; r < 2; r++) {
            for (int q = 0; q < 3; q++) {
                cells.add(new DungeonCell(topology.roomAnchorQ() + q, topology.roomAnchorR() + r, 0));
            }
        }
        return List.copyOf(cells);
    }

    private List<DungeonCell> buildCorridorCells(SpatialTopology topology) {
        int startQ = topology.roomAnchorQ() + 1;
        int startR = topology.roomAnchorR() + 2;
        return List.of(
                new DungeonCell(startQ, startR, 0),
                new DungeonCell(startQ, startR + 1, 0),
                new DungeonCell(startQ, startR + 2, 0)
        );
    }

    private record BoundaryKey(DungeonCell lower, DungeonCell upper) {

        static BoundaryKey from(DungeonEdge edge) {
            DungeonCell from = edge.from();
            DungeonCell to = edge.to();
            int comparison = Comparator
                    .comparingInt(DungeonCell::level)
                    .thenComparingInt(DungeonCell::r)
                    .thenComparingInt(DungeonCell::q)
                    .compare(from, to);
            return comparison <= 0 ? new BoundaryKey(from, to) : new BoundaryKey(to, from);
        }
    }

    private record DirectionStep(src.domain.dungeon.map.value.DungeonEdgeDirection direction) {

        private static final List<DirectionStep> CARDINAL = List.of(
                new DirectionStep(src.domain.dungeon.map.value.DungeonEdgeDirection.NORTH),
                new DirectionStep(src.domain.dungeon.map.value.DungeonEdgeDirection.EAST),
                new DirectionStep(src.domain.dungeon.map.value.DungeonEdgeDirection.SOUTH),
                new DirectionStep(src.domain.dungeon.map.value.DungeonEdgeDirection.WEST));

        DungeonCell neighbor(DungeonCell cell) {
            return direction.neighborOf(cell);
        }
    }
}
