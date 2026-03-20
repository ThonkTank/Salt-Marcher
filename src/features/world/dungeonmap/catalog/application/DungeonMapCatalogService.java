package features.world.dungeonmap.catalog.application;

import database.DatabaseManager;
import features.world.dungeonmap.catalog.persistence.DungeonMapCatalogPersistence;
import features.world.quarantine.dungeonmap.foundation.db.DungeonTransactionSupport;
import features.world.quarantine.dungeonmap.foundation.db.DungeonTransactionSupport.SqlConsumer;
import features.world.quarantine.dungeonmap.rooms.application.DungeonRoomTopologyCoordinator;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.Objects;

public final class DungeonMapCatalogService {

    private final DungeonRoomTopologyCoordinator roomTopologySupport;
    private final SqlConsumer<Connection> afterDeleteHook;

    public DungeonMapCatalogService(
            DungeonRoomTopologyCoordinator roomTopologySupport,
            SqlConsumer<Connection> afterDeleteHook
    ) {
        this.roomTopologySupport = Objects.requireNonNull(roomTopologySupport, "roomTopologySupport");
        this.afterDeleteHook = Objects.requireNonNull(afterDeleteHook, "afterDeleteHook");
    }

    public long createMap(String name) throws SQLException {
        try (Connection conn = DatabaseManager.getConnection()) {
            return DungeonTransactionSupport.inTransaction(conn, () -> {
                long mapId = DungeonMapCatalogPersistence.insertMap(conn, name);
                roomTopologySupport.createDefaultRoom(conn, mapId);
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
            DungeonTransactionSupport.inTransaction(conn, () -> {
                DungeonMapCatalogPersistence.deleteMap(conn, mapId);
                afterDeleteHook.accept(conn);
                return null;
            });
        }
    }
}
