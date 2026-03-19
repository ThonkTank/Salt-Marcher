package features.world.quarantine.dungeonmap.corridors.model.topology;

import features.world.quarantine.dungeonmap.corridors.model.primitives.DoorSegment;
import features.world.quarantine.dungeonmap.foundation.geometry.Point2i;
import features.world.quarantine.dungeonmap.layout.model.DungeonLayout;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoomGeometry;
import features.world.quarantine.dungeonmap.rooms.model.RoomShape;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

final class CorridorTopologyBuilder {

    private CorridorTopologyBuilder() {
        throw new AssertionError("No instances");
    }

    static CorridorTopology build(
            DungeonLayout layout,
            Map<Long, CorridorGeometry> baseGeometries
    ) {
        Map<Point2i, Set<Long>> corridorIdsByCell = indexCorridorCells(baseGeometries);
        Map<DoorKey, Set<Long>> corridorIdsByDoor = indexCorridorDoors(baseGeometries);
        Map<Long, Set<Long>> adjacentCorridors = buildAdjacencyMap(baseGeometries, corridorIdsByCell, corridorIdsByDoor);
        Set<Long> routableIds = baseGeometries.values().stream()
                .filter(CorridorGeometry::routable)
                .map(CorridorGeometry::corridorId)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        List<Set<Long>> components = findConnectedComponents(routableIds, adjacentCorridors);
        return assembleTopology(components, baseGeometries, layout);
    }

    private static Map<Point2i, Set<Long>> indexCorridorCells(Map<Long, CorridorGeometry> baseGeometries) {
        Map<Point2i, Set<Long>> corridorIdsByCell = new HashMap<>();
        for (CorridorGeometry geometry : baseGeometries.values()) {
            if (!geometry.routable()) {
                continue;
            }
            for (Point2i cell : geometry.cells()) {
                corridorIdsByCell.computeIfAbsent(cell, ignored -> new LinkedHashSet<>()).add(geometry.corridorId());
            }
        }
        return corridorIdsByCell;
    }

    private static Map<DoorKey, Set<Long>> indexCorridorDoors(Map<Long, CorridorGeometry> baseGeometries) {
        Map<DoorKey, Set<Long>> corridorIdsByDoor = new HashMap<>();
        for (CorridorGeometry geometry : baseGeometries.values()) {
            if (!geometry.routable()) {
                continue;
            }
            for (DoorSegment door : geometry.doors()) {
                corridorIdsByDoor.computeIfAbsent(new DoorKey(door.start(), door.end()), ignored -> new LinkedHashSet<>()).add(geometry.corridorId());
            }
        }
        return corridorIdsByDoor;
    }

    private static Map<Long, Set<Long>> buildAdjacencyMap(
            Map<Long, CorridorGeometry> baseGeometries,
            Map<Point2i, Set<Long>> corridorIdsByCell,
            Map<DoorKey, Set<Long>> corridorIdsByDoor
    ) {
        Map<Long, Set<Long>> adjacentCorridors = new HashMap<>();
        for (Long corridorId : baseGeometries.keySet()) {
            adjacentCorridors.put(corridorId, new LinkedHashSet<>());
        }
        for (Set<Long> overlapping : corridorIdsByCell.values()) {
            linkCorridors(adjacentCorridors, overlapping);
        }
        for (Set<Long> overlapping : corridorIdsByDoor.values()) {
            linkCorridors(adjacentCorridors, overlapping);
        }
        return adjacentCorridors;
    }

    private static List<Set<Long>> findConnectedComponents(Set<Long> routableIds, Map<Long, Set<Long>> adjacentCorridors) {
        List<Set<Long>> components = new ArrayList<>();
        Set<Long> unvisited = new LinkedHashSet<>(routableIds);
        while (!unvisited.isEmpty()) {
            Long seed = unvisited.iterator().next();
            Set<Long> componentCorridorIds = new LinkedHashSet<>();
            ArrayDeque<Long> queue = new ArrayDeque<>();
            queue.add(seed);
            unvisited.remove(seed);
            while (!queue.isEmpty()) {
                Long corridorId = queue.removeFirst();
                componentCorridorIds.add(corridorId);
                for (Long neighbor : adjacentCorridors.getOrDefault(corridorId, Set.of())) {
                    if (unvisited.remove(neighbor)) {
                        queue.addLast(neighbor);
                    }
                }
            }
            components.add(componentCorridorIds);
        }
        return components;
    }

    private static CorridorTopology assembleTopology(
            List<Set<Long>> components,
            Map<Long, CorridorGeometry> baseGeometries,
            DungeonLayout layout
    ) {
        Map<Long, String> componentIdByCorridorId = new LinkedHashMap<>();
        Map<String, CorridorComponent> componentsById = new LinkedHashMap<>();
        for (Set<Long> componentCorridorIds : components) {
            String componentId = componentIdFor(componentCorridorIds);
            componentsById.put(componentId, buildComponent(componentId, componentCorridorIds, baseGeometries, layout));
            for (Long corridorId : componentCorridorIds) {
                componentIdByCorridorId.put(corridorId, componentId);
            }
        }
        Map<Long, CorridorGeometry> resolvedGeometries = new LinkedHashMap<>();
        for (CorridorGeometry geometry : baseGeometries.values()) {
            resolvedGeometries.put(geometry.corridorId(), geometry.withComponentId(componentIdByCorridorId.get(geometry.corridorId())));
        }
        return new CorridorTopology(
                Map.copyOf(resolvedGeometries),
                Map.copyOf(componentsById),
                Map.copyOf(componentIdByCorridorId));
    }

    private static CorridorComponent buildComponent(
            String componentId,
            Set<Long> componentCorridorIds,
            Map<Long, CorridorGeometry> baseGeometries,
            DungeonLayout layout
    ) {
        Set<Long> roomIds = new LinkedHashSet<>();
        Set<Point2i> cells = new LinkedHashSet<>();
        Set<DoorSegment> doors = new LinkedHashSet<>();
        for (Long corridorId : componentCorridorIds) {
            CorridorGeometry geometry = baseGeometries.get(corridorId);
            roomIds.addAll(geometry.roomIds());
            cells.addAll(geometry.cells());
            doors.addAll(geometry.doors());
        }
        RoomShape componentShape = cells.isEmpty() ? null : DungeonRoomGeometry.roomShapeForCells(cells);
        List<Point2i> outlineVertices = componentShape == null ? List.of() : componentShape.absoluteVertices();
        return new CorridorComponent(
                componentId,
                layout.map().mapId(),
                Set.copyOf(componentCorridorIds),
                Set.copyOf(roomIds),
                Set.copyOf(cells),
                List.copyOf(outlineVertices),
                List.copyOf(doors));
    }

    private static void linkCorridors(Map<Long, Set<Long>> adjacentCorridors, Set<Long> corridorIds) {
        if (corridorIds.size() < 2) {
            return;
        }
        for (Long corridorId : corridorIds) {
            adjacentCorridors.computeIfAbsent(corridorId, ignored -> new LinkedHashSet<>()).addAll(corridorIds);
            adjacentCorridors.get(corridorId).remove(corridorId);
        }
    }

    private static String componentIdFor(Set<Long> corridorIds) {
        return "corridor-component:" + corridorIds.stream()
                .sorted()
                .map(String::valueOf)
                .reduce((left, right) -> left + "," + right)
                .orElse("empty");
    }

    private record DoorKey(Point2i start, Point2i end) {
    }
}
