package features.world.dungeonmap.application.corridor;

import database.DatabaseManager;
import features.world.dungeonmap.application.stair.DungeonStairEditService;
import features.world.dungeonmap.application.support.DungeonTransactionRunner;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.corridor.planning.CorridorPlan;
import features.world.dungeonmap.model.structures.corridor.planning.StairPlacement;
import features.world.dungeonmap.persistence.DungeonCorridorWriteRepository;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

public final class DungeonCorridorEditService {

    private final DungeonCorridorWriteRepository corridorWriteRepository;
    private final DungeonCorridorPersistenceService corridorPersistenceService;
    private final DungeonStairEditService stairEditService;

    public DungeonCorridorEditService(
            DungeonCorridorWriteRepository corridorWriteRepository,
            DungeonCorridorPersistenceService corridorPersistenceService,
            DungeonStairEditService stairEditService
    ) {
        this.corridorWriteRepository = Objects.requireNonNull(corridorWriteRepository, "corridorWriteRepository");
        this.corridorPersistenceService = Objects.requireNonNull(corridorPersistenceService, "corridorPersistenceService");
        this.stairEditService = Objects.requireNonNull(stairEditService, "stairEditService");
    }

    public void create(DungeonLayout layout, List<Long> roomIds) throws SQLException {
        requireLayout(layout);
        Set<Long> requestedRoomIds = roomIds == null ? Set.of() : Set.copyOf(roomIds.stream()
                .filter(Objects::nonNull)
                .toList());
        if (requestedRoomIds.size() < 2 || layout.findCorridorContainingAllRooms(requestedRoomIds) != null) {
            return;
        }
        rejectSameClusterOnlyCorridor(layout, requestedRoomIds);
        Corridor corridor = Corridor.resolved(null, layout.mapId(), roomIds,
                null, null, null);
        CorridorPlan plan = corridor.isPersistable()
                ? corridor.plan(layout.corridorPlanningInput())
                : null;
        List<StairPlacement> stairPlacements = plan != null ? plan.stairPlacements() : List.of();
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                long corridorId = corridorWriteRepository.insertCorridor(conn, layout.mapId(), roomIds);
                System.err.println("CorridorEditService.create(): corridorId=" + corridorId
                        + " stairPlacements=" + stairPlacements.size());
                stairEditService.replaceCorridorTraversalStairs(conn, layout, corridorId, stairPlacements);
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
        Set<Long> mergedRoomIds = new LinkedHashSet<>(corridor.roomIds());
        mergedRoomIds.add(roomId);
        rejectSameClusterOnlyCorridor(layout, mergedRoomIds);
        persistCorridor(layout, corridor.withAddedRoom(roomId));
    }

    public void merge(DungeonLayout layout, long keptCorridorId, long mergedCorridorId) throws SQLException {
        requireLayout(layout);
        if (keptCorridorId == mergedCorridorId) {
            return;
        }
        Corridor kept = requireCorridor(layout, keptCorridorId);
        Corridor merged = requireCorridor(layout, mergedCorridorId);
        Set<Long> mergedRoomIds = new LinkedHashSet<>(kept.roomIds());
        mergedRoomIds.addAll(merged.roomIds());
        rejectSameClusterOnlyCorridor(layout, mergedRoomIds);
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

    private static void rejectSameClusterOnlyCorridor(DungeonLayout layout, Set<Long> roomIds) {
        if (isSameClusterOnlyCorridor(layout, roomIds)) {
            throw new IllegalArgumentException("Korridore innerhalb eines Clusters sind nicht erlaubt");
        }
    }

    private static boolean isSameClusterOnlyCorridor(DungeonLayout layout, Set<Long> roomIds) {
        if (layout == null || roomIds == null || roomIds.size() < 2) {
            return false;
        }
        Set<Long> clusterIds = new LinkedHashSet<>();
        for (Long roomId : roomIds) {
            if (roomId == null) {
                continue;
            }
            var room = layout.findRoom(roomId);
            if (room == null) {
                return false;
            }
            clusterIds.add(room.clusterId());
            if (clusterIds.size() > 1) {
                return false;
            }
        }
        return clusterIds.size() == 1;
    }

    private void persistCorridor(DungeonLayout layout, Corridor corridor) throws SQLException {
        persistCorridor(layout, corridor, null);
    }

    private void persistCorridor(DungeonLayout layout, Corridor corridor, Long deletedCorridorId) throws SQLException {
        Corridor updated;
        List<StairPlacement> stairPlacements;
        if (corridor.isPersistable()) {
            CorridorPlan plan = corridor.plan(layout.corridorPlanningInput());
            updated = corridor.applyPlan(plan);
            stairPlacements = plan.stairPlacements();
        } else {
            updated = corridor;
            stairPlacements = List.of();
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                if (updated.corridorId() != null) {
                    stairEditService.replaceCorridorTraversalStairs(
                            conn,
                            layout,
                            updated.corridorId(),
                            stairPlacements);
                }
                corridorPersistenceService.persistCorridor(conn, updated);
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
