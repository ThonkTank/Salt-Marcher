package features.world.dungeonmap.catalog.application;

import features.world.dungeonmap.catalog.model.DungeonMap;
import features.world.dungeonmap.foundation.db.DungeonConnectionFactory;
import features.world.dungeonmap.layout.application.support.DungeonRuntimeStateSupport;
import features.world.dungeonmap.catalog.persistence.DungeonMapCatalogPersistence;
import features.world.dungeonmap.foundation.db.DungeonTransactionSupport;
import features.world.dungeonmap.rooms.application.DungeonRoomTopologyCoordinator;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;
import java.util.Objects;

/**
 * Public facade for dungeon map catalog workflows such as listing, creating, renaming, and deleting maps.
 */
public final class DungeonMapCatalogService {

    private final DungeonConnectionFactory connectionFactory;
    private final DungeonRoomTopologyCoordinator roomTopologySupport;

    public DungeonMapCatalogService(DungeonConnectionFactory connectionFactory, DungeonRoomTopologyCoordinator roomTopologySupport) {
        this.connectionFactory = Objects.requireNonNull(connectionFactory, "connectionFactory");
        this.roomTopologySupport = Objects.requireNonNull(roomTopologySupport, "roomTopologySupport");
    }

    public List<DungeonMap> getAllMaps() throws SQLException {
        try (Connection conn = connectionFactory.getConnection()) {
            return DungeonMapCatalogPersistence.getAllMaps(conn);
        }
    }

    public long createMap(String name) throws SQLException {
        try (Connection conn = connectionFactory.getConnection()) {
            return DungeonTransactionSupport.inTransaction(conn, () -> {
                long mapId = DungeonMapCatalogPersistence.insertMap(conn, name);
                roomTopologySupport.createDefaultRoom(conn, mapId);
                return mapId;
            });
        }
    }

    public void renameMap(long mapId, String name) throws SQLException {
        try (Connection conn = connectionFactory.getConnection()) {
            DungeonMapCatalogPersistence.updateMapName(conn, mapId, name);
        }
    }

    public void deleteMap(long mapId) throws SQLException {
        try (Connection conn = connectionFactory.getConnection()) {
            DungeonTransactionSupport.inTransaction(conn, () -> {
                DungeonMapCatalogPersistence.deleteMap(conn, mapId);
                DungeonRuntimeStateSupport.repairStoredRuntimeState(conn);
                return null;
            });
        }
    }
}
