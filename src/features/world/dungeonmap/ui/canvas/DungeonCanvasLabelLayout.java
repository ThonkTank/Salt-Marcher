package features.world.dungeonmap.ui.canvas;

import features.world.dungeonmap.model.DungeonSquare;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

final class DungeonCanvasLabelLayout {

    private final Map<Long, List<DungeonSquare>> squaresByRoomId = new HashMap<>();
    private final Map<Long, RoomLabelAnchor> roomLabelAnchors = new HashMap<>();
    private final List<AreaLabelAnchor> areaLabelAnchors = new ArrayList<>();

    void rebuild(Map<String, DungeonSquare> squaresByCoord) {
        squaresByRoomId.clear();
        roomLabelAnchors.clear();
        areaLabelAnchors.clear();
        for (DungeonSquare square : squaresByCoord.values()) {
            if (square.roomId() != null) {
                squaresByRoomId.computeIfAbsent(square.roomId(), ignored -> new ArrayList<>()).add(square);
            }
        }
        for (Map.Entry<Long, List<DungeonSquare>> entry : squaresByRoomId.entrySet()) {
            RoomLabelAnchor anchor = selectRoomLabelAnchor(entry.getValue());
            if (anchor != null) {
                roomLabelAnchors.put(entry.getKey(), anchor);
            }
        }
        rebuildAreaLabelAnchors(squaresByCoord);
    }

    Map<Long, List<DungeonSquare>> squaresByRoomId() {
        return squaresByRoomId;
    }

    Map<Long, RoomLabelAnchor> roomLabelAnchors() {
        return roomLabelAnchors;
    }

    List<AreaLabelAnchor> areaLabelAnchors() {
        return areaLabelAnchors;
    }

    private void rebuildAreaLabelAnchors(Map<String, DungeonSquare> squaresByCoord) {
        Set<String> visited = new HashSet<>();
        for (DungeonSquare square : squaresByCoord.values()) {
            if (square.areaId() == null || square.areaName() == null || square.areaName().isBlank()) {
                continue;
            }
            String coordKey = key(square.x(), square.y());
            if (visited.contains(coordKey)) {
                continue;
            }
            List<DungeonSquare> componentSquares = collectAreaComponent(square, visited, squaresByCoord);
            LabelAnchor anchor = selectLabelAnchor(componentSquares);
            if (anchor == null) {
                continue;
            }
            areaLabelAnchors.add(new AreaLabelAnchor(
                    square.areaId(),
                    square.areaName(),
                    anchor.x(),
                    anchor.y(),
                    anchor.squareCount()));
        }
    }

    private List<DungeonSquare> collectAreaComponent(
            DungeonSquare start,
            Set<String> visited,
            Map<String, DungeonSquare> squaresByCoord
    ) {
        List<DungeonSquare> component = new ArrayList<>();
        ArrayDeque<DungeonSquare> queue = new ArrayDeque<>();
        queue.add(start);
        visited.add(key(start.x(), start.y()));
        Long areaId = start.areaId();
        while (!queue.isEmpty()) {
            DungeonSquare current = queue.removeFirst();
            component.add(current);
            collectAreaNeighbor(areaId, current.x() - 1, current.y(), visited, queue, squaresByCoord);
            collectAreaNeighbor(areaId, current.x() + 1, current.y(), visited, queue, squaresByCoord);
            collectAreaNeighbor(areaId, current.x(), current.y() - 1, visited, queue, squaresByCoord);
            collectAreaNeighbor(areaId, current.x(), current.y() + 1, visited, queue, squaresByCoord);
        }
        return component;
    }

    private void collectAreaNeighbor(
            Long areaId,
            int x,
            int y,
            Set<String> visited,
            ArrayDeque<DungeonSquare> queue,
            Map<String, DungeonSquare> squaresByCoord
    ) {
        String coordKey = key(x, y);
        if (visited.contains(coordKey)) {
            return;
        }
        DungeonSquare neighbor = squaresByCoord.get(coordKey);
        if (neighbor == null || neighbor.areaId() == null || !neighbor.areaId().equals(areaId)) {
            return;
        }
        visited.add(coordKey);
        queue.addLast(neighbor);
    }

    private RoomLabelAnchor selectRoomLabelAnchor(List<DungeonSquare> squares) {
        LabelAnchor anchor = selectLabelAnchor(squares);
        return anchor == null ? null : new RoomLabelAnchor(anchor.x(), anchor.y(), anchor.squareCount());
    }

    private LabelAnchor selectLabelAnchor(List<DungeonSquare> squares) {
        if (squares == null || squares.isEmpty()) {
            return null;
        }
        Set<String> roomCoords = new HashSet<>();
        double centerX = 0.0;
        double centerY = 0.0;
        for (DungeonSquare square : squares) {
            roomCoords.add(key(square.x(), square.y()));
            centerX += square.x() + 0.5;
            centerY += square.y() + 0.5;
        }
        centerX /= squares.size();
        centerY /= squares.size();

        DungeonSquare bestSquare = null;
        int bestNeighborCount = -1;
        double bestDistance = Double.MAX_VALUE;
        for (DungeonSquare square : squares) {
            int neighborCount = roomNeighborCount(square, roomCoords);
            double dx = (square.x() + 0.5) - centerX;
            double dy = (square.y() + 0.5) - centerY;
            double distance = (dx * dx) + (dy * dy);
            if (bestSquare == null
                    || neighborCount > bestNeighborCount
                    || neighborCount == bestNeighborCount && distance < bestDistance
                    || neighborCount == bestNeighborCount && distance == bestDistance && square.y() < bestSquare.y()
                    || neighborCount == bestNeighborCount && distance == bestDistance && square.y() == bestSquare.y() && square.x() < bestSquare.x()) {
                bestSquare = square;
                bestNeighborCount = neighborCount;
                bestDistance = distance;
            }
        }
        return new LabelAnchor(bestSquare.x(), bestSquare.y(), squares.size());
    }

    private int roomNeighborCount(DungeonSquare square, Set<String> roomCoords) {
        int neighbors = 0;
        if (roomCoords.contains(key(square.x() - 1, square.y()))) neighbors++;
        if (roomCoords.contains(key(square.x() + 1, square.y()))) neighbors++;
        if (roomCoords.contains(key(square.x(), square.y() - 1))) neighbors++;
        if (roomCoords.contains(key(square.x(), square.y() + 1))) neighbors++;
        return neighbors;
    }

    private static String key(int x, int y) {
        return x + ":" + y;
    }

    private record LabelAnchor(int x, int y, int squareCount) {
    }

    record RoomLabelAnchor(int x, int y, int squareCount) {
    }

    record AreaLabelAnchor(Long areaId, String areaName, int x, int y, int squareCount) {
    }
}
