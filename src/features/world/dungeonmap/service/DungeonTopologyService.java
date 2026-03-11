package features.world.dungeonmap.service;

import features.world.dungeonmap.model.DungeonEndpoint;
import features.world.dungeonmap.model.DungeonPassage;
import features.world.dungeonmap.model.DungeonRoom;
import features.world.dungeonmap.model.DungeonSquare;
import features.world.dungeonmap.model.DungeonSquarePaint;
import features.world.dungeonmap.model.PassageDirection;
import features.world.dungeonmap.repository.DungeonEndpointRepository;
import features.world.dungeonmap.repository.DungeonMapRepository;
import features.world.dungeonmap.repository.DungeonPassageRepository;
import features.world.dungeonmap.repository.DungeonRoomRepository;
import features.world.dungeonmap.repository.DungeonSquareRepository;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

public final class DungeonTopologyService {

    private DungeonTopologyService() {
        throw new AssertionError("No instances");
    }

    public static void applySquareEdits(Connection conn, long mapId, List<DungeonSquarePaint> edits) throws SQLException {
        Set<Long> affectedRoomIds = collectRoomsAffectedByErasedSquares(conn, mapId, edits);
        DungeonSquareRepository.applySquareEdits(conn, mapId, edits);
        reconcileAfterGeometryChange(conn, mapId, affectedRoomIds);
    }

    public static void shrinkMap(Connection conn, long mapId, int width, int height) throws SQLException {
        Set<Long> affectedRoomIds = collectRoomsAffectedByOutOfBoundsSquares(conn, mapId, width, height);
        DungeonMapRepository.deleteSquaresOutsideBounds(conn, mapId, width, height);
        reconcileAfterGeometryChange(conn, mapId, affectedRoomIds);
    }

    public static void validatePassageForSave(Connection conn, DungeonPassage passage) throws SQLException {
        if (!isPassageEdgeValid(conn, passage.mapId(), passage.x(), passage.y(), passage.direction())) {
            throw new IllegalArgumentException("Passage edge is no longer valid for map " + passage.mapId());
        }
        if (passage.endpointId() == null) {
            return;
        }
        Optional<DungeonEndpoint> endpoint = DungeonEndpointRepository.findEndpoint(conn, passage.endpointId());
        if (endpoint.isEmpty() || endpoint.get().mapId() == null || endpoint.get().mapId() != passage.mapId()) {
            throw new IllegalArgumentException("Passage endpoint does not belong to map " + passage.mapId());
        }
    }

    public static void deleteInvalidPassages(Connection conn, long mapId) throws SQLException {
        DungeonPassageRepository.deleteInvalidPassages(conn, mapId);
    }

    private static void reconcileAfterGeometryChange(Connection conn, long mapId, Set<Long> affectedRoomIds) throws SQLException {
        deleteInvalidPassages(conn, mapId);
        if (!affectedRoomIds.isEmpty()) {
            splitDisconnectedRooms(conn, mapId, affectedRoomIds);
        }
    }

    private static boolean isPassageEdgeValid(Connection conn, long mapId, int x, int y, PassageDirection direction) throws SQLException {
        if (direction == PassageDirection.EAST) {
            return squareExists(conn, mapId, x, y) && squareExists(conn, mapId, x + 1, y);
        }
        return squareExists(conn, mapId, x, y) && squareExists(conn, mapId, x, y + 1);
    }

    private static boolean squareExists(Connection conn, long mapId, int x, int y) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT 1 FROM dungeon_squares WHERE map_id=? AND x=? AND y=?")) {
            ps.setLong(1, mapId);
            ps.setInt(2, x);
            ps.setInt(3, y);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next();
            }
        }
    }

    private static Set<Long> collectRoomsAffectedByErasedSquares(Connection conn, long mapId, List<DungeonSquarePaint> edits) throws SQLException {
        Set<Long> roomIds = new HashSet<>();
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT room_id FROM dungeon_squares WHERE map_id=? AND x=? AND y=? AND room_id IS NOT NULL")) {
            for (DungeonSquarePaint edit : edits) {
                if (edit.filled()) {
                    continue;
                }
                ps.setLong(1, mapId);
                ps.setInt(2, edit.x());
                ps.setInt(3, edit.y());
                try (ResultSet rs = ps.executeQuery()) {
                    if (rs.next()) {
                        roomIds.add(rs.getLong(1));
                    }
                }
            }
        }
        return roomIds;
    }

    private static Set<Long> collectRoomsAffectedByOutOfBoundsSquares(Connection conn, long mapId, int width, int height) throws SQLException {
        Set<Long> roomIds = new HashSet<>();
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT DISTINCT room_id FROM dungeon_squares "
                        + "WHERE map_id=? AND room_id IS NOT NULL AND (x >= ? OR y >= ?)")) {
            ps.setLong(1, mapId);
            ps.setInt(2, width);
            ps.setInt(3, height);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    roomIds.add(rs.getLong(1));
                }
            }
        }
        return roomIds;
    }

    private static void splitDisconnectedRooms(Connection conn, long mapId, Set<Long> affectedRoomIds) throws SQLException {
        List<DungeonSquare> allSquares = DungeonSquareRepository.getSquares(conn, mapId);
        Map<Long, List<DungeonSquare>> squaresByRoomId = new HashMap<>();
        for (DungeonSquare square : allSquares) {
            if (square.roomId() != null) {
                squaresByRoomId.computeIfAbsent(square.roomId(), ignored -> new ArrayList<>()).add(square);
            }
        }

        Map<Long, DungeonRoom> roomsById = new HashMap<>();
        for (DungeonRoom room : DungeonRoomRepository.getRooms(conn, mapId)) {
            roomsById.put(room.roomId(), room);
        }

        for (Long roomId : affectedRoomIds) {
            DungeonRoom originalRoom = roomsById.get(roomId);
            List<DungeonSquare> roomSquares = squaresByRoomId.get(roomId);
            if (originalRoom == null || roomSquares == null || roomSquares.isEmpty()) {
                continue;
            }

            List<List<DungeonSquare>> components = connectedComponents(roomSquares);
            if (components.size() <= 1) {
                continue;
            }

            int largestComponentIndex = findLargestComponentIndex(components);
            int splitRoomIndex = 1;
            for (int i = 0; i < components.size(); i++) {
                if (i == largestComponentIndex) {
                    continue;
                }
                DungeonRoom splitRoom = new DungeonRoom(
                        null,
                        mapId,
                        splitRoomName(originalRoom.name(), splitRoomIndex++),
                        originalRoom.description(),
                        originalRoom.areaId());
                long newRoomId = DungeonRoomRepository.upsertRoom(conn, splitRoom);
                for (DungeonSquare square : components.get(i)) {
                    DungeonSquareRepository.assignSquareRoom(conn, square.squareId(), newRoomId);
                }
            }
        }
    }

    private static List<List<DungeonSquare>> connectedComponents(List<DungeonSquare> roomSquares) {
        Map<String, DungeonSquare> squaresByCoord = new HashMap<>();
        for (DungeonSquare square : roomSquares) {
            squaresByCoord.put(coordKey(square.x(), square.y()), square);
        }

        Set<String> visited = new HashSet<>();
        List<List<DungeonSquare>> components = new ArrayList<>();
        for (DungeonSquare start : roomSquares) {
            String startKey = coordKey(start.x(), start.y());
            if (!visited.add(startKey)) {
                continue;
            }
            List<DungeonSquare> component = new ArrayList<>();
            Deque<DungeonSquare> queue = new ArrayDeque<>();
            queue.add(start);
            while (!queue.isEmpty()) {
                DungeonSquare current = queue.removeFirst();
                component.add(current);
                enqueueNeighbor(current.x() + 1, current.y(), squaresByCoord, visited, queue);
                enqueueNeighbor(current.x() - 1, current.y(), squaresByCoord, visited, queue);
                enqueueNeighbor(current.x(), current.y() + 1, squaresByCoord, visited, queue);
                enqueueNeighbor(current.x(), current.y() - 1, squaresByCoord, visited, queue);
            }
            components.add(component);
        }
        return components;
    }

    private static void enqueueNeighbor(
            int x,
            int y,
            Map<String, DungeonSquare> squaresByCoord,
            Set<String> visited,
            Deque<DungeonSquare> queue
    ) {
        String key = coordKey(x, y);
        DungeonSquare neighbor = squaresByCoord.get(key);
        if (neighbor != null && visited.add(key)) {
            queue.addLast(neighbor);
        }
    }

    private static int findLargestComponentIndex(List<List<DungeonSquare>> components) {
        int largestIndex = 0;
        for (int i = 1; i < components.size(); i++) {
            if (components.get(i).size() > components.get(largestIndex).size()) {
                largestIndex = i;
            }
        }
        return largestIndex;
    }

    private static String splitRoomName(String baseName, int splitRoomIndex) {
        return baseName + " (geteilt " + splitRoomIndex + ")";
    }

    private static String coordKey(int x, int y) {
        return x + ":" + y;
    }
}
