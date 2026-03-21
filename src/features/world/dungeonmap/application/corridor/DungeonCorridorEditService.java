package features.world.dungeonmap.application.corridor;

import database.DatabaseManager;
import features.world.dungeonmap.application.support.DungeonTransactionRunner;
import features.world.dungeonmap.loading.DungeonMapLoadResult;
import features.world.dungeonmap.loading.DungeonMapLoader;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.persistence.DungeonCorridorWriteRepository;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

public final class DungeonCorridorEditService {

    private final DungeonMapLoader mapLoader;
    private final DungeonCorridorWriteRepository corridorWriteRepository;

    public DungeonCorridorEditService(
            DungeonMapLoader mapLoader,
            DungeonCorridorWriteRepository corridorWriteRepository
    ) {
        this.mapLoader = Objects.requireNonNull(mapLoader, "mapLoader");
        this.corridorWriteRepository = Objects.requireNonNull(corridorWriteRepository, "corridorWriteRepository");
    }

    public void create(long mapId, List<Long> roomIds) throws SQLException {
        DungeonLayout layout = requireLayout(mapId);
        Set<Long> requestedRoomIds = roomIds == null ? Set.of() : Set.copyOf(roomIds.stream()
                .filter(Objects::nonNull)
                .toList());
        if (requestedRoomIds.size() < 2 || layout.findCorridorContainingAllRooms(requestedRoomIds) != null) {
            return;
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                corridorWriteRepository.insertCorridor(conn, mapId, roomIds);
                return null;
            });
        }
    }

    public void delete(long mapId, long corridorId) throws SQLException {
        requireLayout(mapId);
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                corridorWriteRepository.deleteCorridor(conn, corridorId);
                return null;
            });
        }
    }

    public void addRoom(long mapId, long corridorId, long roomId) throws SQLException {
        DungeonLayout layout = requireLayout(mapId);
        Corridor corridor = requireCorridor(layout, corridorId);
        persistCorridor(layout, corridor.withAddedRoom(roomId));
    }

    public void merge(long mapId, long keptCorridorId, long mergedCorridorId) throws SQLException {
        DungeonLayout layout = requireLayout(mapId);
        if (keptCorridorId == mergedCorridorId) {
            return;
        }
        Corridor kept = requireCorridor(layout, keptCorridorId);
        Corridor merged = requireCorridor(layout, mergedCorridorId);
        LinkedHashSet<Long> roomIds = new LinkedHashSet<>(kept.roomIds());
        roomIds.addAll(merged.roomIds());
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                corridorWriteRepository.replaceCorridorRooms(conn, keptCorridorId, List.copyOf(roomIds));
                corridorWriteRepository.deleteCorridor(conn, mergedCorridorId);
                return null;
            });
        }
    }

    public void removeRoom(long mapId, long corridorId, long roomId) throws SQLException {
        DungeonLayout layout = requireLayout(mapId);
        Corridor corridor = requireCorridor(layout, corridorId);
        persistCorridor(layout, corridor.withRemovedRoom(roomId));
    }

    private DungeonLayout requireLayout(long mapId) throws SQLException {
        DungeonMapLoadResult loadResult = mapLoader.loadMap(mapId, List.of());
        if (loadResult.activeMap() == null) {
            throw new SQLException("Dungeon " + mapId + " konnte nicht geladen werden");
        }
        return loadResult.activeMap();
    }

    private void persistCorridor(DungeonLayout layout, Corridor corridor) throws SQLException {
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                corridorWriteRepository.replaceCorridorRooms(conn, corridor.corridorId(), corridor.roomIds());
                if (corridor.isPersistable()) {
                    Corridor updated = corridor.replanned(layout.corridorPlanningInput());
                    corridorWriteRepository.replaceCorridorWaypoints(conn, updated.corridorId(), updated.bindings().waypoints());
                    corridorWriteRepository.replaceCorridorDoorBindings(conn, updated.corridorId(), updated.bindings().doorBindings());
                }
                return null;
            });
        }
    }

    private static Corridor requireCorridor(DungeonLayout layout, long corridorId) {
        Corridor corridor = layout.findCorridor(corridorId);
        if (corridor == null) {
            throw new IllegalArgumentException("Unbekannter Korridor: " + corridorId);
        }
        return corridor;
    }
}
