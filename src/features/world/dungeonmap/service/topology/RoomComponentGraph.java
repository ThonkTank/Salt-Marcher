package features.world.dungeonmap.service.topology;

import features.world.dungeonmap.model.DungeonSquare;
import features.world.dungeonmap.model.DungeonWall;
import features.world.dungeonmap.model.PassageDirection;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

final class RoomComponentGraph {

    private RoomComponentGraph() {
    }

    static List<RoomComponent> buildRoomComponents(
            List<DungeonSquare> squares,
            Map<String, DungeonWall> wallsByEdge
    ) {
        Map<String, DungeonSquare> squaresByCoord = new HashMap<>();
        for (DungeonSquare square : squares) {
            squaresByCoord.put(TopologyWorkspace.coordKey(square.x(), square.y()), square);
        }

        Set<String> visited = new HashSet<>();
        List<RoomComponent> components = new ArrayList<>();
        int componentIndex = 0;
        for (DungeonSquare start : squares) {
            String startKey = TopologyWorkspace.coordKey(start.x(), start.y());
            if (!visited.add(startKey)) {
                continue;
            }
            List<DungeonSquare> componentSquares = new ArrayList<>();
            Map<Long, Integer> roomSquareCounts = new HashMap<>();
            Set<Long> roomIds = new LinkedHashSet<>();
            ArrayDeque<DungeonSquare> queue = new ArrayDeque<>();
            queue.add(start);
            while (!queue.isEmpty()) {
                DungeonSquare current = queue.removeFirst();
                componentSquares.add(current);
                if (current.roomId() != null) {
                    roomIds.add(current.roomId());
                    roomSquareCounts.merge(current.roomId(), 1, Integer::sum);
                }
                enqueueRoomNeighbor(current, current.x() + 1, current.y(), squaresByCoord, wallsByEdge, visited, queue);
                enqueueRoomNeighbor(current, current.x() - 1, current.y(), squaresByCoord, wallsByEdge, visited, queue);
                enqueueRoomNeighbor(current, current.x(), current.y() + 1, squaresByCoord, wallsByEdge, visited, queue);
                enqueueRoomNeighbor(current, current.x(), current.y() - 1, squaresByCoord, wallsByEdge, visited, queue);
            }
            int minX = Integer.MAX_VALUE;
            int minY = Integer.MAX_VALUE;
            Set<String> squareCoords = new HashSet<>();
            for (DungeonSquare square : componentSquares) {
                minX = Math.min(minX, square.x());
                minY = Math.min(minY, square.y());
                squareCoords.add(TopologyWorkspace.coordKey(square.x(), square.y()));
            }
            components.add(new RoomComponent(componentIndex++, componentSquares, roomSquareCounts, roomIds, squareCoords, minX, minY));
        }
        return components;
    }

    static Map<Long, Integer> findLargestComponentByRoom(
            List<RoomComponent> components,
            TopologyIntent intent
    ) {
        Map<Long, Integer> result = new HashMap<>();
        Map<Long, Integer> bestSizeByRoom = new HashMap<>();
        for (RoomComponent component : components) {
            for (Map.Entry<Long, Integer> entry : component.roomSquareCounts().entrySet()) {
                Long roomId = entry.getKey();
                if (roomId == null) {
                    continue;
                }
                int componentSize = entry.getValue();
                int currentBestSize = bestSizeByRoom.getOrDefault(roomId, -1);
                if (componentSize > currentBestSize) {
                    bestSizeByRoom.put(roomId, componentSize);
                    result.put(roomId, component.index());
                    continue;
                }
                if (componentSize == currentBestSize) {
                    RoomComponent currentBestComponent = components.get(result.get(roomId));
                    if (componentWinsTie(component, currentBestComponent, intent)) {
                        result.put(roomId, component.index());
                    }
                }
            }
        }
        return result;
    }

    static List<Long> retainableRoomIds(RoomComponent component, Map<Long, Integer> largestComponentByRoomId) {
        List<Long> result = new ArrayList<>();
        for (Long roomId : component.roomIds()) {
            if (roomId != null && largestComponentByRoomId.getOrDefault(roomId, -1) == component.index()) {
                result.add(roomId);
            }
        }
        return result;
    }

    private static void enqueueRoomNeighbor(
            DungeonSquare current,
            int neighborX,
            int neighborY,
            Map<String, DungeonSquare> squaresByCoord,
            Map<String, DungeonWall> wallsByEdge,
            Set<String> visited,
            ArrayDeque<DungeonSquare> queue
    ) {
        DungeonSquare neighbor = squaresByCoord.get(TopologyWorkspace.coordKey(neighborX, neighborY));
        if (neighbor == null || hasBoundaryWallBetween(current.x(), current.y(), neighborX, neighborY, wallsByEdge)) {
            return;
        }
        String key = TopologyWorkspace.coordKey(neighborX, neighborY);
        if (visited.add(key)) {
            queue.addLast(neighbor);
        }
    }

    private static boolean hasBoundaryWallBetween(
            int x1,
            int y1,
            int x2,
            int y2,
            Map<String, DungeonWall> wallsByEdge
    ) {
        if (x1 == x2) {
            int minY = Math.min(y1, y2);
            return wallsByEdge.containsKey(PassageDirection.SOUTH.edgeKey(x1, minY));
        }
        int minX = Math.min(x1, x2);
        return wallsByEdge.containsKey(PassageDirection.EAST.edgeKey(minX, y1));
    }

    private static boolean componentWinsTie(
            RoomComponent candidate,
            RoomComponent currentBest,
            TopologyIntent intent
    ) {
        int candidateEditedOrder = firstEditedCellOrder(candidate, intent);
        int currentEditedOrder = firstEditedCellOrder(currentBest, intent);
        if (candidateEditedOrder != currentEditedOrder) {
            return candidateEditedOrder < currentEditedOrder;
        }
        if (candidate.minY() != currentBest.minY()) {
            return candidate.minY() < currentBest.minY();
        }
        if (candidate.minX() != currentBest.minX()) {
            return candidate.minX() < currentBest.minX();
        }
        return candidate.index() < currentBest.index();
    }

    private static int firstEditedCellOrder(RoomComponent component, TopologyIntent intent) {
        if (intent == null || intent.componentPriorityCells().isEmpty()) {
            return Integer.MAX_VALUE;
        }
        for (int i = 0; i < intent.componentPriorityCells().size(); i++) {
            EditedCell editedCell = intent.componentPriorityCells().get(i);
            if (component.contains(editedCell.x(), editedCell.y())) {
                return i;
            }
        }
        return Integer.MAX_VALUE;
    }

    record RoomComponent(
            int index,
            List<DungeonSquare> squares,
            Map<Long, Integer> roomSquareCounts,
            Set<Long> roomIds,
            Set<String> squareCoords,
            int minX,
            int minY
    ) {
        boolean contains(int x, int y) {
            return squareCoords.contains(TopologyWorkspace.coordKey(x, y));
        }
    }
}
