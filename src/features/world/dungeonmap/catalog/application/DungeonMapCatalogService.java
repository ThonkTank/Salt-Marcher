package features.world.dungeonmap.catalog.application;

import database.DatabaseManager;
import features.world.dungeonmap.application.runtime.DungeonRuntimeApplicationService;
import features.world.dungeonmap.application.room.DungeonRoomApplicationService;
import features.world.dungeonmap.application.support.DungeonTransactionRunner;
import features.world.dungeonmap.catalog.persistence.DungeonMapCatalogRepository;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.Objects;

public final class DungeonMapCatalogService {

    private final DungeonRoomApplicationService roomApplicationService;
    private final DungeonRuntimeApplicationService runtimeApplicationService;

    public DungeonMapCatalogService(
            DungeonRoomApplicationService roomApplicationService,
            DungeonRuntimeApplicationService runtimeApplicationService
    ) {
        this.roomApplicationService = Objects.requireNonNull(roomApplicationService, "roomApplicationService");
        this.runtimeApplicationService = Objects.requireNonNull(runtimeApplicationService, "runtimeApplicationService");
    }

    public long createMap(String name) throws SQLException {
        try (Connection conn = DatabaseManager.getConnection()) {
            return DungeonTransactionRunner.inTransaction(conn, () -> {
                long mapId;
                try {
                    mapId = DungeonMapCatalogRepository.insertMap(conn, name);
                } catch (SQLException exception) {
                    throw new SQLException("Dungeon map insert failed", exception);
                }
                try {
                    roomApplicationService.createDefaultRoom(conn, mapId);
                } catch (SQLException | RuntimeException exception) {
                    throw new SQLException("Default room bootstrap failed for dungeon " + mapId, exception);
                }
                return mapId;
            });
        }
    }

    public void renameMap(long mapId, String name) throws SQLException {
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonMapCatalogRepository.updateMapName(conn, mapId, name);
        }
    }

    public void deleteMap(long mapId) throws SQLException {
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                DungeonMapCatalogRepository.deleteMap(conn, mapId);
                runtimeApplicationService.repairStoredRuntimeState(conn);
                return null;
            });
        }
    }
}
