package features.world.dungeonmap.model.structures.corridor;

import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.TileShape;
import features.world.dungeonmap.model.objects.Door;
import features.world.dungeonmap.model.objects.Floor;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Derived runtime grouping of routable corridors that touch by floor cells or corridor doors.
 */
public final class CorridorNetwork {

    private final String networkId;
    private final long mapId;
    private final Set<Long> corridorIds;
    private final Set<Long> roomIds;
    private final Floor floor;

    public CorridorNetwork(String networkId, long mapId, Set<Long> corridorIds, Set<Long> roomIds, Floor floor) {
        this.networkId = networkId;
        this.mapId = mapId;
        this.corridorIds = corridorIds == null ? Set.of() : Set.copyOf(corridorIds);
        this.roomIds = roomIds == null ? Set.of() : Set.copyOf(roomIds);
        this.floor = floor == null ? new Floor(TileShape.empty()) : floor;
    }

    public String networkId() {
        return networkId;
    }

    public long mapId() {
        return mapId;
    }

    public Set<Long> corridorIds() {
        return corridorIds;
    }

    public Set<Long> roomIds() {
        return roomIds;
    }

    public Floor floor() {
        return floor;
    }

    public boolean containsCorridor(Long corridorId) {
        return corridorId != null && corridorIds.contains(corridorId);
    }

    public boolean containsRoom(Long roomId) {
        return roomId != null && roomIds.contains(roomId);
    }

    public static List<CorridorNetwork> buildNetworks(long mapId, List<Corridor> corridors, List<Door> doors) {
        Map<Long, Corridor> routableById = new LinkedHashMap<>();
        Map<Point2i, Set<Long>> corridorIdsByCell = new LinkedHashMap<>();
        for (Corridor corridor : corridors == null ? List.<Corridor>of() : corridors) {
            if (corridor == null || corridor.corridorId() == null || corridor.path() == null || !corridor.path().routable()) {
                continue;
            }
            routableById.put(corridor.corridorId(), corridor);
            for (Point2i cell : corridor.path().floor().shape().absoluteCells()) {
                corridorIdsByCell.computeIfAbsent(cell, ignored -> new LinkedHashSet<>()).add(corridor.corridorId());
            }
        }
        Map<Long, Set<Long>> adjacency = new LinkedHashMap<>();
        for (Long corridorId : routableById.keySet()) {
            adjacency.put(corridorId, new LinkedHashSet<>());
        }
        linkOverlaps(adjacency, corridorIdsByCell.values());
        linkDoorOverlaps(adjacency, doors);
        List<Set<Long>> components = connectedComponents(routableById.keySet(), adjacency);
        List<CorridorNetwork> result = new ArrayList<>();
        for (Set<Long> component : components) {
            result.add(buildNetwork(mapId, component, routableById));
        }
        return List.copyOf(result);
    }

    private static CorridorNetwork buildNetwork(long mapId, Set<Long> component, Map<Long, Corridor> corridorsById) {
        Set<Long> roomIds = new LinkedHashSet<>();
        Set<Point2i> cells = new LinkedHashSet<>();
        for (Long corridorId : component) {
            Corridor corridor = corridorsById.get(corridorId);
            if (corridor == null) {
                continue;
            }
            roomIds.addAll(corridor.roomIds());
            cells.addAll(corridor.path().floor().shape().absoluteCells());
        }
        return new CorridorNetwork(
                networkIdFor(component),
                mapId,
                component,
                roomIds,
                new Floor(TileShape.fromAbsoluteCells(cells)));
    }

    private static void linkDoorOverlaps(Map<Long, Set<Long>> adjacency, List<Door> doors) {
        for (Door door : doors == null ? List.<Door>of() : doors) {
            if (door == null || door.sides().isEmpty()) {
                continue;
            }
            Set<Long> touchingCorridors = new LinkedHashSet<>();
            for (Door.DoorSide side : door.sides()) {
                if (side != null && side.type() == Door.SideType.CORRIDOR && side.id() != null) {
                    touchingCorridors.add(side.id());
                }
            }
            linkOverlaps(adjacency, List.of(touchingCorridors));
        }
    }

    private static void linkOverlaps(Map<Long, Set<Long>> adjacency, Iterable<Set<Long>> overlappingIds) {
        for (Set<Long> overlaps : overlappingIds) {
            if (overlaps.size() < 2) {
                continue;
            }
            for (Long corridorId : overlaps) {
                adjacency.computeIfAbsent(corridorId, ignored -> new LinkedHashSet<>()).addAll(overlaps);
                adjacency.get(corridorId).remove(corridorId);
            }
        }
    }

    private static List<Set<Long>> connectedComponents(Set<Long> corridorIds, Map<Long, Set<Long>> adjacency) {
        Set<Long> unvisited = new LinkedHashSet<>(corridorIds);
        List<Set<Long>> result = new ArrayList<>();
        while (!unvisited.isEmpty()) {
            Long seed = unvisited.iterator().next();
            Set<Long> component = new LinkedHashSet<>();
            ArrayDeque<Long> queue = new ArrayDeque<>();
            queue.add(seed);
            unvisited.remove(seed);
            while (!queue.isEmpty()) {
                Long current = queue.removeFirst();
                if (!component.add(current)) {
                    continue;
                }
                for (Long neighbor : adjacency.getOrDefault(current, Set.of())) {
                    if (unvisited.remove(neighbor)) {
                        queue.addLast(neighbor);
                    }
                }
            }
            result.add(Set.copyOf(component));
        }
        return List.copyOf(result);
    }

    private static String networkIdFor(Set<Long> component) {
        return "corridor-network:" + component.stream()
                .sorted()
                .map(String::valueOf)
                .reduce((left, right) -> left + "," + right)
                .orElse("empty");
    }
}
