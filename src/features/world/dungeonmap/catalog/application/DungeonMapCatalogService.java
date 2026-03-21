package features.world.dungeonmap.catalog.application;

import database.DatabaseManager;
import features.world.dungeonmap.application.runtime.DungeonRuntimeStateRepairService;
import features.world.dungeonmap.application.room.DungeonRoomTopologyService;
import features.world.dungeonmap.application.support.DungeonTransactionRunner;
import features.world.dungeonmap.catalog.persistence.DungeonMapCatalogPersistence;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.Objects;

public final class DungeonMapCatalogService {

    private final DungeonRoomTopologyService roomTopologyService;
    private final DungeonRuntimeStateRepairService runtimeStateRepairService;

    public DungeonMapCatalogService(
            DungeonRoomTopologyService roomTopologyService,
            DungeonRuntimeStateRepairService runtimeStateRepairService
    ) {
        this.roomTopologyService = Objects.requireNonNull(roomTopologyService, "roomTopologyService");
        this.runtimeStateRepairService = Objects.requireNonNull(runtimeStateRepairService, "runtimeStateRepairService");
    }

    public long createMap(String name) throws SQLException {
        try (Connection conn = DatabaseManager.getConnection()) {
            return DungeonTransactionRunner.inTransaction(conn, () -> {
                long mapId = DungeonMapCatalogPersistence.insertMap(conn, name);
                roomTopologyService.createDefaultRoom(conn, mapId);
                return mapId;
            });
        }
    }

    public void renameMap(long mapId, String name) throws SQLException {
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonMapCatalogPersistence.updateMapName(conn, mapId, name);
        }
    }

    public void deleteMap(long mapId) throws SQLException {
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                DungeonMapCatalogPersistence.deleteMap(conn, mapId);
                runtimeStateRepairService.repairStoredRuntimeState(conn);
                return null;
            });
        }
    }
}
