package features.world.dungeonmap.service;

import database.DatabaseManager;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.DungeonMap;
import features.world.dungeonmap.model.DungeonRuntimeState;
import features.world.dungeonmap.model.Point2i;
import features.world.dungeonmap.repository.DungeonRepository;
import features.world.dungeonmap.service.adapter.DungeonCampaignStateAdapter;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

public final class DungeonMapService {

    private DungeonMapService() {
        throw new AssertionError("No instances");
    }

    public static List<DungeonMap> getAllMaps() throws Exception {
        try (Connection conn = DatabaseManager.getConnection()) {
            return DungeonRepository.getAllMaps(conn);
        }
    }

    public static long createMap(String name) throws Exception {
        try (Connection conn = DatabaseManager.getConnection()) {
            long mapId = DungeonRepository.insertMap(conn, name);
            createDefaultRoom(conn, mapId);
            return mapId;
        }
    }

    public static void renameMap(long mapId, String name) throws Exception {
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonRepository.updateMapName(conn, mapId, name);
        }
    }

    public static DungeonLayout loadLayout(long mapId) throws Exception {
        try (Connection conn = DatabaseManager.getConnection()) {
            return DungeonRepository.loadLayout(conn, mapId)
                    .orElseThrow(() -> new IllegalArgumentException("Unbekannte Dungeon-Map: " + mapId));
        }
    }

    public static void ensureDefaultMapExists() throws Exception {
        try (Connection conn = DatabaseManager.getConnection()) {
            if (DungeonRepository.firstMapId(conn).isPresent()) {
                return;
            }
            long newMapId = DungeonRepository.insertMap(conn, "Dungeon");
            createDefaultRoom(conn, newMapId);
        }
    }

    public static DungeonRuntimeState loadPreferredRuntimeState() throws Exception {
        try (Connection conn = DatabaseManager.getConnection()) {
            Optional<DungeonLayout> preferredLayout = loadPreferredLayout(conn);
            if (preferredLayout.isEmpty()) {
                throw new IllegalStateException("Keine Dungeon-Map vorhanden");
            }
            return toRuntimeState(conn, preferredLayout.orElseThrow());
        }
    }

    public static DungeonRuntimeState loadRuntimeState(long mapId) throws Exception {
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonLayout layout = DungeonRepository.loadLayout(conn, mapId)
                    .orElseThrow(() -> new IllegalArgumentException("Unbekannte Dungeon-Map: " + mapId));
            return toRuntimeState(conn, layout);
        }
    }

    public static long addRoom(long mapId) throws Exception {
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonLayout layout = DungeonRepository.loadLayout(conn, mapId)
                    .orElseThrow(() -> new IllegalArgumentException("Unbekannte Dungeon-Map: " + mapId));
            Point2i center = DungeonGeometry.suggestNewRoomCenter(layout.rooms());
            String name = "Raum " + (layout.rooms().size() + 1);
            return DungeonRepository.insertRoom(conn, mapId, name, center, DungeonGeometry.standardRoomVertices());
        }
    }

    public static void moveRoom(long roomId, String name, Point2i center) throws Exception {
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonRepository.updateRoom(conn, roomId, name, center);
        }
    }

    public static void deleteRoom(long roomId) throws Exception {
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonRepository.deleteRoom(conn, roomId);
        }
    }

    public static long connectRooms(long mapId, long fromRoomId, long toRoomId) throws Exception {
        try (Connection conn = DatabaseManager.getConnection()) {
            return DungeonRepository.insertCorridor(conn, mapId, fromRoomId, toRoomId);
        }
    }

    public static void deleteCorridor(long corridorId) throws Exception {
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonRepository.deleteCorridor(conn, corridorId);
        }
    }

    public static void updateActiveRoom(long mapId, long roomId) throws Exception {
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonCampaignStateAdapter.updateActiveRoom(conn, mapId, roomId);
        }
    }

    private static Optional<DungeonLayout> loadPreferredLayout(Connection conn) throws SQLException {
        Optional<Long> storedMapId = DungeonCampaignStateAdapter.getStoredMapId(conn);
        if (storedMapId.isPresent()) {
            Optional<DungeonLayout> storedLayout = DungeonRepository.loadLayout(conn, storedMapId.orElseThrow());
            if (storedLayout.isPresent()) {
                return storedLayout;
            }
        }
        Optional<Long> firstMapId = DungeonRepository.firstMapId(conn);
        if (firstMapId.isEmpty()) {
            return Optional.empty();
        }
        return DungeonRepository.loadLayout(conn, firstMapId.orElseThrow());
    }

    private static DungeonRuntimeState toRuntimeState(Connection conn, DungeonLayout layout) throws SQLException {
        Long activeRoomId = resolveAndRepairActiveRoomId(conn, layout);
        return new DungeonRuntimeState(layout, activeRoomId);
    }

    private static Long resolveAndRepairActiveRoomId(Connection conn, DungeonLayout layout) throws SQLException {
        Long storedActiveRoomId = DungeonCampaignStateAdapter.getStoredActiveRoomId(conn, layout.map().mapId());
        Long resolvedActiveRoomId = resolveActiveRoomId(layout, storedActiveRoomId);
        if (resolvedActiveRoomId != null) {
            if (!resolvedActiveRoomId.equals(storedActiveRoomId)) {
                // Runtime state and persisted campaign state must agree on the active room.
                DungeonCampaignStateAdapter.updateActiveRoom(conn, layout.map().mapId(), resolvedActiveRoomId);
            }
            return resolvedActiveRoomId;
        }
        if (storedActiveRoomId != null) {
            DungeonCampaignStateAdapter.clearActiveRoom(conn);
        }
        return null;
    }

    private static Long resolveActiveRoomId(DungeonLayout layout, Long roomId) {
        if (roomId != null && containsRoomId(layout, roomId)) {
            return roomId;
        }
        return layout.rooms().stream()
                .map(room -> room.roomId())
                .filter(id -> id != null)
                .min(Comparator.naturalOrder())
                .orElse(null);
    }

    private static boolean containsRoomId(DungeonLayout layout, Long roomId) {
        return layout.rooms().stream()
                .map(room -> room.roomId())
                .anyMatch(roomId::equals);
    }

    private static void createDefaultRoom(Connection conn, long mapId) throws Exception {
        DungeonRepository.insertRoom(conn, mapId, "Eingang", new Point2i(0, 0), DungeonGeometry.standardRoomVertices());
    }
}
