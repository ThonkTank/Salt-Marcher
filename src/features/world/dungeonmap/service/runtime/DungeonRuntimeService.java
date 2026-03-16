package features.world.dungeonmap.service.runtime;

import features.world.dungeonmap.model.DungeonRuntimeLocation;
import features.world.dungeonmap.model.DungeonRuntimeState;
import features.world.dungeonmap.repository.DungeonRepository;
import features.world.dungeonmap.service.DungeonConnectionFactory;
import features.world.dungeonmap.service.DungeonTransactionSupport;
import features.world.dungeonmap.service.campaignstate.DungeonCampaignStateAdapter;
import features.world.dungeonmap.service.topology.DungeonRoomTopologySupport;

import java.sql.Connection;
import java.util.Objects;

/**
 * Public facade for dungeon runtime navigation state and party location workflows.
 */
public final class DungeonRuntimeService {

    private final DungeonConnectionFactory connectionFactory;

    public DungeonRuntimeService(DungeonConnectionFactory connectionFactory) {
        this.connectionFactory = Objects.requireNonNull(connectionFactory, "connectionFactory");
    }

    public DungeonRuntimeState loadPreferredRuntimeState() throws Exception {
        try (Connection conn = connectionFactory.getConnection()) {
            ensureDefaultMapExists(conn);
            return DungeonRuntimeSupport.loadPreferredRuntimeState(conn);
        }
    }

    public DungeonRuntimeState loadRuntimeState(long mapId) throws Exception {
        try (Connection conn = connectionFactory.getConnection()) {
            return DungeonRuntimeSupport.loadRuntimeState(conn, mapId);
        }
    }

    public void updateActiveLocation(long mapId, DungeonRuntimeLocation location) throws Exception {
        try (Connection conn = connectionFactory.getConnection()) {
            DungeonCampaignStateAdapter.updateActiveLocation(conn, mapId, location);
        }
    }

    public void repairStoredRuntimeState() throws Exception {
        try (Connection conn = connectionFactory.getConnection()) {
            DungeonRuntimeSupport.repairStoredRuntimeState(conn);
        }
    }

    private void ensureDefaultMapExists(Connection conn) throws Exception {
        if (DungeonRepository.firstMapId(conn).isPresent()) {
            return;
        }
        DungeonTransactionSupport.inTransaction(conn, () -> {
            if (DungeonRepository.firstMapId(conn).isPresent()) {
                return null;
            }
            long newMapId = DungeonRepository.insertMap(conn, "Dungeon");
            DungeonRoomTopologySupport.createDefaultRoom(conn, newMapId);
            return null;
        });
    }
}
