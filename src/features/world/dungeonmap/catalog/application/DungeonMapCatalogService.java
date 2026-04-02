package features.world.dungeonmap.catalog.application;

import database.DatabaseManager;
import features.world.dungeonmap.application.runtime.DungeonRuntimeApplicationService;
import features.world.dungeonmap.application.room.DungeonRoomTopologyService;
import features.world.dungeonmap.application.support.DungeonTransactionRunner;
import features.world.dungeonmap.catalog.persistence.DungeonMapCatalogRepository;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.Objects;

public final class DungeonMapCatalogService {

    private final DungeonRoomTopologyService roomTopologyService;
    private final DungeonRuntimeApplicationService runtimeApplicationService;

    public DungeonMapCatalogService(
            DungeonRoomTopologyService roomTopologyService,
            DungeonRuntimeApplicationService runtimeApplicationService
    ) {
        this.roomTopologyService = Objects.requireNonNull(roomTopologyService, "roomTopologyService");
        this.runtimeApplicationService = Objects.requireNonNull(runtimeApplicationService, "runtimeApplicationService");
    }

    public long createMap(String name) throws SQLException {
        try (Connection conn = DatabaseManager.getConnection()) {
            return DungeonTransactionRunner.inTransaction(conn, () -> {
                long mapId = DungeonMapCatalogRepository.insertMap(conn, name);
                roomTopologyService.createDefaultRoom(conn, mapId);
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
