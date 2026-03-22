package features.world.dungeonmap.model.structures.corridor.planning;

import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.VertexEdge;
import features.world.dungeonmap.model.objects.Door;
import features.world.dungeonmap.model.structures.room.Room;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

final class NetworkScorer {

    private NetworkScorer() {
    }

    static int corridorCornerCount(Set<Point2i> corridorCells) {
        int corners = 0;
        for (Point2i cell : corridorCells == null ? Set.<Point2i>of() : corridorCells) {
            boolean horizontal = corridorCells.contains(cell.add(new Point2i(-1, 0)))
                    || corridorCells.contains(cell.add(new Point2i(1, 0)));
            boolean vertical = corridorCells.contains(cell.add(new Point2i(0, -1)))
                    || corridorCells.contains(cell.add(new Point2i(0, 1)));
            if (horizontal && vertical) {
                corners++;
            }
        }
        return corners;
    }

    private static Integer connectionDistance(
            Long sourceRoomId,
            Long targetRoomId,
            Set<RoomPair> directRoomPairs,
            Map<Integer, Map<Long, Set<Point2i>>> attachmentCellsByComponentAndRoom
    ) {
        if (directRoomPairs.contains(RoomPair.of(sourceRoomId, targetRoomId))) {
            return 1;
        }
        Integer best = null;
        for (Map<Long, Set<Point2i>> attachmentsByRoom : attachmentCellsByComponentAndRoom.values()) {
            Set<Point2i> sourceAttachments = attachmentsByRoom.get(sourceRoomId);
            Set<Point2i> targetAttachments = attachmentsByRoom.get(targetRoomId);
            if (sourceAttachments == null || targetAttachments == null) {
                continue;
            }
            int distance = minimumAttachmentDistance(sourceAttachments, targetAttachments);
            if (best == null || distance < best) {
                best = distance;
            }
        }
        return best;
    }

    private static int minimumAttachmentDistance(Set<Point2i> sourceAttachments, Set<Point2i> targetAttachments) {
        int best = Integer.MAX_VALUE;
        for (Point2i source : sourceAttachments) {
            for (Point2i target : targetAttachments) {
                best = Math.min(best, source.distanceTo(target) + 2);
            }
        }
        return best;
    }

    private static List<Set<Point2i>> corridorComponents(Set<Point2i> corridorCells) {
        if (corridorCells == null || corridorCells.isEmpty()) {
            return List.of();
        }
        List<Set<Point2i>> components = new ArrayList<>();
        Set<Point2i> unvisited = new LinkedHashSet<>(corridorCells);
        while (!unvisited.isEmpty()) {
            Point2i start = unvisited.iterator().next();
            Set<Point2i> component = new LinkedHashSet<>();
            ArrayDeque<Point2i> queue = new ArrayDeque<>();
            queue.add(start);
            unvisited.remove(start);
            while (!queue.isEmpty()) {
                Point2i cell = queue.removeFirst();
                component.add(cell);
                for (Point2i step : Point2i.CARDINAL_STEPS) {
                    Point2i neighbor = cell.add(step);
                    if (unvisited.remove(neighbor)) {
                        queue.addLast(neighbor);
                    }
                }
            }
            components.add(Set.copyOf(component));
        }
        return List.copyOf(components);
    }

    record NetworkScore(
            int componentCount,
            int unreachablePairCount,
            int distanceSum,
            int maxDistance,
            int corridorCellCount,
            int cornerCount
    ) implements Comparable<NetworkScore> {
        private int routeValue() {
            return RouteSearch.routeValue(corridorCellCount, cornerCount);
        }

        static NetworkScore forNetwork(
                List<Room> rooms,
                Set<Point2i> corridorCells,
                Iterable<Door> doors
        ) {
            Map<Long, Room> roomsById = new LinkedHashMap<>();
            Map<Point2i, Long> occupancy = new LinkedHashMap<>();
            for (Room room : rooms == null ? List.<Room>of() : rooms) {
                if (room == null || room.roomId() == null) {
                    continue;
                }
                roomsById.put(room.roomId(), room);
                for (Point2i cell : room.cells()) {
                    occupancy.put(cell, room.roomId());
                }
            }
            List<Set<Point2i>> corridorComponents = corridorComponents(corridorCells);
            Map<Point2i, Integer> componentIndexByCell = new HashMap<>();
            for (int componentIndex = 0; componentIndex < corridorComponents.size(); componentIndex++) {
                for (Point2i cell : corridorComponents.get(componentIndex)) {
                    componentIndexByCell.put(cell, componentIndex);
                }
            }
            Map<Integer, Map<Long, Set<Point2i>>> attachmentCellsByComponentAndRoom = new HashMap<>();
            Set<RoomPair> directRoomPairs = new HashSet<>();
            Iterable<Door> safeDoors = doors == null ? List.<Door>of() : doors;
            for (Door door : safeDoors) {
                for (VertexEdge edge : door.edges()) {
                    Set<Point2i> touchingCells = edge.touchingCells();
                    Long firstRoom = null;
                    Long secondRoom = null;
                    Point2i corridorCell = null;
                    for (Point2i cell : touchingCells) {
                        Long roomId = occupancy.get(cell);
                        if (roomId != null) {
                            if (firstRoom == null) {
                                firstRoom = roomId;
                            } else if (!Objects.equals(firstRoom, roomId)) {
                                secondRoom = roomId;
                            }
                        } else if (corridorCells.contains(cell)) {
                            corridorCell = cell;
                        }
                    }
                    if (firstRoom != null && secondRoom != null) {
                        directRoomPairs.add(RoomPair.of(firstRoom, secondRoom));
                        continue;
                    }
                    if (firstRoom != null && corridorCell != null) {
                        Integer componentIndex = componentIndexByCell.get(corridorCell);
                        if (componentIndex != null) {
                            attachmentCellsByComponentAndRoom
                                    .computeIfAbsent(componentIndex, ignored -> new HashMap<>())
                                    .computeIfAbsent(firstRoom, ignored -> new LinkedHashSet<>())
                                    .add(corridorCell);
                        }
                    }
                }
            }
            int unreachablePairCount = 0;
            int distanceSum = 0;
            int maxDistance = 0;
            List<Long> orderedRoomIds = roomsById.keySet().stream().sorted().toList();
            for (int index = 0; index < orderedRoomIds.size(); index++) {
                Long sourceRoomId = orderedRoomIds.get(index);
                for (int otherIndex = index + 1; otherIndex < orderedRoomIds.size(); otherIndex++) {
                    Long targetRoomId = orderedRoomIds.get(otherIndex);
                    Integer distance = connectionDistance(
                            sourceRoomId,
                            targetRoomId,
                            directRoomPairs,
                            attachmentCellsByComponentAndRoom);
                    if (distance == null) {
                        unreachablePairCount++;
                        continue;
                    }
                    distanceSum += distance;
                    maxDistance = Math.max(maxDistance, distance);
                }
            }
            return new NetworkScore(
                    corridorComponents.size(),
                    unreachablePairCount,
                    distanceSum,
                    maxDistance,
                    corridorCells.size(),
                    corridorCornerCount(corridorCells));
        }

        @Override
        public int compareTo(NetworkScore other) {
            int compare = Integer.compare(componentCount, other.componentCount);
            if (compare != 0) {
                return compare;
            }
            compare = Integer.compare(unreachablePairCount, other.unreachablePairCount);
            if (compare != 0) {
                return compare;
            }
            compare = RouteSearch.compareRoutePriority(corridorCellCount, cornerCount, other.corridorCellCount, other.cornerCount);
            if (compare != 0) {
                return compare;
            }
            compare = Integer.compare(distanceSum, other.distanceSum);
            if (compare != 0) {
                return compare;
            }
            compare = Integer.compare(maxDistance, other.maxDistance);
            if (compare != 0) {
                return compare;
            }
            return Integer.compare(routeValue(), other.routeValue());
        }
    }
}

record RoomPair(Long firstRoomId, Long secondRoomId) {
    static RoomPair of(Long firstRoomId, Long secondRoomId) {
        if (firstRoomId == null || secondRoomId == null) {
            return new RoomPair(firstRoomId, secondRoomId);
        }
        return firstRoomId <= secondRoomId
                ? new RoomPair(firstRoomId, secondRoomId)
                : new RoomPair(secondRoomId, firstRoomId);
    }
}
