package features.world.dungeonmap.application.corridor;

import database.DatabaseManager;
import features.world.dungeonmap.application.support.DungeonTransactionRunner;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.persistence.DungeonCorridorWriteRepository;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;
import java.util.Objects;
import java.util.Set;

public final class DungeonCorridorEditService {

    private final DungeonCorridorWriteRepository corridorWriteRepository;

    public DungeonCorridorEditService(DungeonCorridorWriteRepository corridorWriteRepository) {
        this.corridorWriteRepository = Objects.requireNonNull(corridorWriteRepository, "corridorWriteRepository");
    }

    public void create(DungeonLayout layout, List<Long> roomIds) throws SQLException {
        requireLayout(layout);
        Set<Long> requestedRoomIds = roomIds == null ? Set.of() : Set.copyOf(roomIds.stream()
                .filter(Objects::nonNull)
                .toList());
        if (requestedRoomIds.size() < 2 || layout.findCorridorContainingAllRooms(requestedRoomIds) != null) {
            return;
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                corridorWriteRepository.insertCorridor(conn, layout.mapId(), roomIds);
                return null;
            });
        }
    }

    public void delete(long corridorId) throws SQLException {
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                corridorWriteRepository.deleteCorridor(conn, corridorId);
                return null;
            });
        }
    }

    public void addRoom(DungeonLayout layout, long corridorId, long roomId) throws SQLException {
        requireLayout(layout);
        Corridor corridor = requireCorridor(layout, corridorId);
        persistCorridor(layout, corridor.withAddedRoom(roomId));
    }

    public void merge(DungeonLayout layout, long keptCorridorId, long mergedCorridorId) throws SQLException {
        requireLayout(layout);
        if (keptCorridorId == mergedCorridorId) {
            return;
        }
        Corridor kept = requireCorridor(layout, keptCorridorId);
        Corridor merged = requireCorridor(layout, mergedCorridorId);
        persistCorridor(layout, kept.mergeWith(merged), mergedCorridorId);
    }

    public void removeRoom(DungeonLayout layout, long corridorId, long roomId) throws SQLException {
        requireLayout(layout);
        Corridor corridor = requireCorridor(layout, corridorId);
        persistCorridor(layout, corridor.withRemovedRoom(roomId));
    }

    private static void requireLayout(DungeonLayout layout) throws SQLException {
        if (layout == null) {
            throw new SQLException("Dungeon konnte nicht geladen werden");
        }
    }

    private void persistCorridor(DungeonLayout layout, Corridor corridor) throws SQLException {
        persistCorridor(layout, corridor, null);
    }

    private void persistCorridor(DungeonLayout layout, Corridor corridor, Long deletedCorridorId) throws SQLException {
        var planningInput = layout.corridorPlanningInput();
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                corridorWriteRepository.replaceCorridorRooms(conn, corridor.corridorId(), corridor.roomIds());
                if (corridor.isPersistable()) {
                    Corridor updated = corridor.replanned(planningInput);
                    corridorWriteRepository.replaceCorridorWaypoints(conn, updated.corridorId(), updated.bindings().waypoints());
                    corridorWriteRepository.replaceCorridorDoorBindings(conn, updated.corridorId(), updated.bindings().doorBindings());
                }
                if (deletedCorridorId != null) {
                    corridorWriteRepository.deleteCorridor(conn, deletedCorridorId);
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
