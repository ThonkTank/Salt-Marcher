package features.world.dungeonmap.service;

import database.DatabaseManager;
import features.world.dungeonmap.model.DungeonArea;
import features.world.dungeonmap.model.DungeonEndpoint;
import features.world.dungeonmap.model.DungeonLink;
import features.world.dungeonmap.model.DungeonMap;
import features.world.dungeonmap.model.DungeonPassage;
import features.world.dungeonmap.model.DungeonRoom;
import features.world.dungeonmap.model.DungeonSquare;
import features.world.dungeonmap.model.DungeonSquarePaint;
import features.world.dungeonmap.repository.DungeonAreaRepository;
import features.world.dungeonmap.repository.DungeonEndpointRepository;
import features.world.dungeonmap.repository.DungeonLinkRepository;
import features.world.dungeonmap.repository.DungeonMapRepository;
import features.world.dungeonmap.repository.DungeonPassageRepository;
import features.world.dungeonmap.repository.DungeonRoomRepository;
import features.world.dungeonmap.repository.DungeonSquareRepository;
import features.world.dungeonmap.service.adapter.DungeonCampaignStateAdapter;

import java.sql.Connection;
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

public final class DungeonMapEditorService {

    public enum LinkCreateStatus {
        CREATED,
        SAME_ENDPOINT,
        DUPLICATE,
        INVALID_ENDPOINT
    }

    public record LinkCreateResult(LinkCreateStatus status, Long linkId) {}

    private DungeonMapEditorService() {
        throw new AssertionError("No instances");
    }

    public static long createMap(String name, int width, int height) throws Exception {
        try (Connection conn = DatabaseManager.getConnection()) {
            return DungeonMapRepository.insertMap(conn, new DungeonMap(null, name, width, height));
        }
    }

    public static void updateMap(long mapId, String name, int width, int height) throws Exception {
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonMap existingMap = DungeonMapRepository.findMap(conn, mapId)
                    .orElseThrow(() -> new IllegalArgumentException("Unknown dungeon map: " + mapId));
            boolean previousAutoCommit = conn.getAutoCommit();
            conn.setAutoCommit(false);
            try {
                DungeonMapRepository.updateMap(conn, mapId, name, width, height);
                if (width < existingMap.width() || height < existingMap.height()) {
                    clearActiveEndpointIfOutsideBounds(conn, mapId, width, height);
                    DungeonMapRepository.deleteSquaresOutsideBounds(conn, mapId, width, height);
                }
                conn.commit();
            } catch (SQLException ex) {
                conn.rollback();
                throw ex;
            } finally {
                conn.setAutoCommit(previousAutoCommit);
            }
        }
    }

    public static void applySquareEditsAndReconcileState(long mapId, List<DungeonSquarePaint> edits) throws Exception {
        try (Connection conn = DatabaseManager.getConnection()) {
            boolean previousAutoCommit = conn.getAutoCommit();
            conn.setAutoCommit(false);
            try {
                clearInvalidActiveEndpointAfterEdits(conn, mapId, edits);
                Set<Long> affectedRoomIds = collectRoomsAffectedByErase(conn, mapId, edits);
                applySquareEditsToRepository(conn, mapId, edits);
                if (!affectedRoomIds.isEmpty()) {
                    splitDisconnectedRoomsAfterErase(conn, mapId, affectedRoomIds);
                }
                conn.commit();
            } catch (SQLException ex) {
                conn.rollback();
                throw ex;
            } finally {
                conn.setAutoCommit(previousAutoCommit);
            }
        }
    }

    public static long saveRoom(DungeonRoom room) throws Exception {
        try (Connection conn = DatabaseManager.getConnection()) {
            return DungeonRoomRepository.upsertRoom(conn, room);
        }
    }

    public static void deleteRoom(long roomId) throws Exception {
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonRoomRepository.deleteRoom(conn, roomId);
        }
    }

    public static void assignSquareRoom(long squareId, Long roomId) throws Exception {
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonSquareRepository.assignSquareRoom(conn, squareId, roomId);
        }
    }

    public static long saveArea(DungeonArea area) throws Exception {
        try (Connection conn = DatabaseManager.getConnection()) {
            return DungeonAreaRepository.upsertArea(conn, area);
        }
    }

    public static void deleteArea(long areaId) throws Exception {
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonAreaRepository.deleteArea(conn, areaId);
        }
    }

    public static void assignRoomArea(long roomId, Long areaId) throws Exception {
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonRoomRepository.assignRoomArea(conn, roomId, areaId);
        }
    }

    public static long saveEndpoint(DungeonEndpoint endpoint) throws Exception {
        try (Connection conn = DatabaseManager.getConnection()) {
            return DungeonEndpointRepository.upsertEndpoint(conn, endpoint);
        }
    }

    public static void deleteEndpoint(long endpointId) throws Exception {
        try (Connection conn = DatabaseManager.getConnection()) {
            Optional<DungeonEndpoint> endpoint = DungeonEndpointRepository.findEndpoint(conn, endpointId);
            if (endpoint.isEmpty()) {
                return;
            }
            boolean previousAutoCommit = conn.getAutoCommit();
            conn.setAutoCommit(false);
            try {
                Long currentEndpointId = DungeonCampaignStateAdapter.getDungeonEndpointId(conn).orElse(null);
                if (currentEndpointId != null && currentEndpointId.equals(endpointId)) {
                    Long currentMapId = DungeonCampaignStateAdapter.getDungeonMapId(conn).orElse(endpoint.get().mapId());
                    DungeonCampaignStateAdapter.updateDungeonPosition(conn, currentMapId, null);
                }
                DungeonEndpointRepository.deleteEndpoint(conn, endpointId);
                conn.commit();
            } catch (SQLException ex) {
                conn.rollback();
                throw ex;
            } finally {
                conn.setAutoCommit(previousAutoCommit);
            }
        }
    }

    public static LinkCreateResult createLink(long mapId, long fromEndpointId, long toEndpointId, String label) throws Exception {
        if (fromEndpointId == toEndpointId) {
            return new LinkCreateResult(LinkCreateStatus.SAME_ENDPOINT, null);
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            Optional<DungeonEndpoint> from = DungeonEndpointRepository.findEndpoint(conn, fromEndpointId);
            Optional<DungeonEndpoint> to = DungeonEndpointRepository.findEndpoint(conn, toEndpointId);
            if (from.isEmpty() || to.isEmpty()
                    || from.get().mapId() != mapId
                    || to.get().mapId() != mapId) {
                return new LinkCreateResult(LinkCreateStatus.INVALID_ENDPOINT, null);
            }
            Long existing = DungeonLinkRepository.findExistingLink(conn, mapId, fromEndpointId, toEndpointId).orElse(null);
            if (existing != null) {
                return new LinkCreateResult(LinkCreateStatus.DUPLICATE, existing);
            }
            long linkId = DungeonLinkRepository.insertLink(conn, new DungeonLink(
                    null, mapId, fromEndpointId, toEndpointId, label, null));
            return new LinkCreateResult(LinkCreateStatus.CREATED, linkId);
        }
    }

    public static void deleteLink(long linkId) throws Exception {
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonLinkRepository.deleteLink(conn, linkId);
        }
    }

    public static void updateLinkLabel(long linkId, String label) throws Exception {
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonLinkRepository.updateLinkLabel(conn, linkId, label);
        }
    }

    public static long savePassage(DungeonPassage passage) throws Exception {
        try (Connection conn = DatabaseManager.getConnection()) {
            return DungeonPassageRepository.upsertPassage(conn, passage);
        }
    }

    public static void deletePassage(long passageId) throws Exception {
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonPassageRepository.deletePassage(conn, passageId);
        }
    }

    private static void applySquareEditsToRepository(Connection conn, long mapId, List<DungeonSquarePaint> edits) throws SQLException {
        DungeonSquareRepository.applySquareEdits(conn, mapId, edits);
    }

    private static Set<Long> collectRoomsAffectedByErase(Connection conn, long mapId, List<DungeonSquarePaint> edits) throws SQLException {
        Set<Long> roomIds = new HashSet<>();
        for (DungeonSquarePaint edit : edits) {
            if (!edit.filled()) {
                String sql = "SELECT room_id FROM dungeon_squares WHERE map_id=? AND x=? AND y=? AND room_id IS NOT NULL";
                try (java.sql.PreparedStatement ps = conn.prepareStatement(sql)) {
                    ps.setLong(1, mapId);
                    ps.setInt(2, edit.x());
                    ps.setInt(3, edit.y());
                    try (java.sql.ResultSet rs = ps.executeQuery()) {
                        if (rs.next()) {
                            roomIds.add(rs.getLong(1));
                        }
                    }
                }
            }
        }
        return roomIds;
    }

    private static void splitDisconnectedRoomsAfterErase(Connection conn, long mapId, Set<Long> affectedRoomIds) throws SQLException {
        List<DungeonSquare> allSquares = DungeonSquareRepository.getSquares(conn, mapId);
        List<DungeonRoom> allRooms = DungeonRoomRepository.getRooms(conn, mapId);
        Map<Long, String> roomNames = new HashMap<>();
        for (DungeonRoom r : allRooms) {
            roomNames.put(r.roomId(), r.name());
        }

        for (Long roomId : affectedRoomIds) {
            if (!roomNames.containsKey(roomId)) continue;
            List<DungeonSquare> roomSquares = new ArrayList<>();
            for (DungeonSquare sq : allSquares) {
                if (roomId.equals(sq.roomId())) {
                    roomSquares.add(sq);
                }
            }
            if (roomSquares.isEmpty()) continue;

            // Build coord set for BFS
            Set<String> coordSet = new HashSet<>();
            for (DungeonSquare sq : roomSquares) {
                coordSet.add(sq.x() + ":" + sq.y());
            }

            // Find connected components
            Set<String> visited = new HashSet<>();
            List<List<DungeonSquare>> components = new ArrayList<>();
            for (DungeonSquare start : roomSquares) {
                String startKey = start.x() + ":" + start.y();
                if (visited.contains(startKey)) continue;
                List<DungeonSquare> component = new ArrayList<>();
                Deque<DungeonSquare> queue = new ArrayDeque<>();
                queue.add(start);
                visited.add(startKey);
                Map<String, DungeonSquare> squareMap = new HashMap<>();
                for (DungeonSquare sq : roomSquares) {
                    squareMap.put(sq.x() + ":" + sq.y(), sq);
                }
                while (!queue.isEmpty()) {
                    DungeonSquare current = queue.poll();
                    component.add(current);
                    int[][] neighbors = {{current.x() + 1, current.y()}, {current.x() - 1, current.y()},
                            {current.x(), current.y() + 1}, {current.x(), current.y() - 1}};
                    for (int[] nb : neighbors) {
                        String nbKey = nb[0] + ":" + nb[1];
                        if (coordSet.contains(nbKey) && !visited.contains(nbKey)) {
                            visited.add(nbKey);
                            queue.add(squareMap.get(nbKey));
                        }
                    }
                }
                components.add(component);
            }

            if (components.size() <= 1) continue;

            // Find largest component — keep in original room
            int largestIdx = 0;
            for (int i = 1; i < components.size(); i++) {
                if (components.get(i).size() > components.get(largestIdx).size()) {
                    largestIdx = i;
                }
            }

            String baseName = roomNames.get(roomId);
            for (int i = 0; i < components.size(); i++) {
                if (i == largestIdx) continue;
                List<DungeonSquare> splitSquares = components.get(i);
                // Create a new room for this component
                DungeonRoom newRoom = new DungeonRoom(null, mapId, baseName + " (geteilt)", null, null);
                long newRoomId = DungeonRoomRepository.upsertRoom(conn, newRoom);
                for (DungeonSquare sq : splitSquares) {
                    DungeonSquareRepository.assignSquareRoom(conn, sq.squareId(), newRoomId);
                }
            }
        }
    }

    private static void clearActiveEndpointIfOutsideBounds(Connection conn, long mapId, int width, int height) throws SQLException {
        Optional<DungeonEndpoint> activeEndpoint = findActiveEndpoint(conn, mapId);
        if (activeEndpoint.isEmpty()) {
            return;
        }
        DungeonEndpoint endpoint = activeEndpoint.get();
        if (endpoint.x() < width && endpoint.y() < height) {
            return;
        }
        DungeonCampaignStateAdapter.updateDungeonPosition(conn, mapId, null);
    }

    private static void clearInvalidActiveEndpointAfterEdits(Connection conn, long mapId, List<DungeonSquarePaint> edits) throws SQLException {
        Optional<DungeonEndpoint> activeEndpoint = findActiveEndpoint(conn, mapId);
        if (activeEndpoint.isEmpty()) {
            return;
        }
        DungeonEndpoint endpoint = activeEndpoint.get();
        for (DungeonSquarePaint edit : edits) {
            if (!edit.filled() && edit.x() == endpoint.x() && edit.y() == endpoint.y()) {
                DungeonCampaignStateAdapter.updateDungeonPosition(conn, mapId, null);
                return;
            }
        }
    }

    private static Optional<DungeonEndpoint> findActiveEndpoint(Connection conn, long mapId) throws SQLException {
        Long currentMapId = DungeonCampaignStateAdapter.getDungeonMapId(conn).orElse(null);
        if (currentMapId == null || currentMapId != mapId) {
            return Optional.empty();
        }
        Long currentEndpointId = DungeonCampaignStateAdapter.getDungeonEndpointId(conn).orElse(null);
        if (currentEndpointId == null) {
            return Optional.empty();
        }
        Optional<DungeonEndpoint> currentEndpoint = DungeonEndpointRepository.findEndpoint(conn, currentEndpointId);
        if (currentEndpoint.isPresent() && currentEndpoint.get().mapId() == mapId) {
            return currentEndpoint;
        }
        DungeonCampaignStateAdapter.updateDungeonPosition(conn, mapId, null);
        return Optional.empty();
    }
}
