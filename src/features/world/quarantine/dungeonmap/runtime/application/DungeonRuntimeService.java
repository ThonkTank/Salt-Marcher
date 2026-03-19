package features.world.quarantine.dungeonmap.runtime.application;

import features.world.quarantine.dungeonmap.runtime.model.DungeonRuntimeLocation;
import features.world.quarantine.dungeonmap.foundation.db.DungeonConnectionFactory;
import features.world.quarantine.dungeonmap.foundation.db.DungeonTransactionSupport;
import features.world.quarantine.dungeonmap.catalog.persistence.DungeonMapCatalogPersistence;
import features.world.quarantine.dungeonmap.rooms.application.DungeonRoomTopologyCoordinator;
import features.world.quarantine.dungeonmap.runtime.model.DungeonRuntimeState;
import features.world.quarantine.dungeonmap.runtime.persistence.DungeonCampaignStateAdapter;

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
