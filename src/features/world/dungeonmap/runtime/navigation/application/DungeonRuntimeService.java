package features.world.dungeonmap.runtime.navigation.application;

import features.world.dungeonmap.layout.application.support.DungeonRuntimeStateSupport;
import features.world.dungeonmap.view.model.DungeonRuntimeLocation;
import features.world.dungeonmap.runtime.model.DungeonRuntimeState;
import features.world.dungeonmap.foundation.db.DungeonConnectionFactory;
import features.world.dungeonmap.runtime.persistence.DungeonCampaignStateAdapter;
import features.world.dungeonmap.catalog.persistence.DungeonMapCatalogPersistence;
import features.world.dungeonmap.foundation.db.DungeonTransactionSupport;
import features.world.dungeonmap.rooms.application.DungeonRoomTopologyCoordinator;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.Objects;

/**
 * Public facade for dungeon runtime navigation state and party location workflows.
 */
public final class DungeonRuntimeService {

    private final DungeonConnectionFactory connectionFactory;
    private final DungeonRoomTopologyCoordinator roomTopologySupport;

    public DungeonRuntimeService(DungeonConnectionFactory connectionFactory, DungeonRoomTopologyCoordinator roomTopologySupport) {
        this.connectionFactory = Objects.requireNonNull(connectionFactory, "connectionFactory");
        this.roomTopologySupport = Objects.requireNonNull(roomTopologySupport, "roomTopologySupport");
    }

    public DungeonRuntimeState loadPreferredRuntimeState() throws SQLException {
        try (Connection conn = connectionFactory.getConnection()) {
            ensureDefaultMapExists(conn);
            return DungeonRuntimeStateSupport.loadPreferredRuntimeState(conn);
        }
    }

    public DungeonRuntimeState loadRuntimeState(long mapId) throws SQLException {
        try (Connection conn = connectionFactory.getConnection()) {
            return DungeonRuntimeStateSupport.loadRuntimeState(conn, mapId);
        }
    }

    public void updateActiveLocation(long mapId, DungeonRuntimeLocation location) throws SQLException {
        try (Connection conn = connectionFactory.getConnection()) {
            DungeonCampaignStateAdapter.updateActiveLocation(conn, mapId, location);
        }
    }

    public void repairStoredRuntimeState() throws SQLException {
        try (Connection conn = connectionFactory.getConnection()) {
            DungeonRuntimeStateSupport.repairStoredRuntimeState(conn);
        }
    }

    private void ensureDefaultMapExists(Connection conn) throws SQLException {
        if (DungeonMapCatalogPersistence.firstMapId(conn).isPresent()) {
            return;
        }
        DungeonTransactionSupport.inTransaction(conn, () -> {
            if (DungeonMapCatalogPersistence.firstMapId(conn).isPresent()) {
                return null;
            }
            long newMapId = DungeonMapCatalogPersistence.insertMap(conn, "Dungeon");
            roomTopologySupport.createDefaultRoom(conn, newMapId);
            return null;
        });
    }
}
