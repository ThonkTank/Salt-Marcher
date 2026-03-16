package features.world.dungeonmap.service.catalog;

import features.world.dungeonmap.model.DungeonMap;
import features.world.dungeonmap.repository.DungeonRepository;
import features.world.dungeonmap.service.DungeonConnectionFactory;
import features.world.dungeonmap.service.DungeonTransactionSupport;
import features.world.dungeonmap.service.runtime.DungeonRuntimeSupport;
import features.world.dungeonmap.service.topology.DungeonRoomTopologySupport;

import java.sql.Connection;
import java.util.List;
import java.util.Objects;

/**
 * Public facade for dungeon map catalog workflows such as listing, creating, renaming, and deleting maps.
 */
public final class DungeonMapCatalogService {

    private final DungeonConnectionFactory connectionFactory;

    public DungeonMapCatalogService(DungeonConnectionFactory connectionFactory) {
        this.connectionFactory = Objects.requireNonNull(connectionFactory, "connectionFactory");
    }

    public List<DungeonMap> getAllMaps() throws Exception {
        try (Connection conn = connectionFactory.getConnection()) {
            return DungeonRepository.getAllMaps(conn);
        }
    }

    public long createMap(String name) throws Exception {
        try (Connection conn = connectionFactory.getConnection()) {
            return DungeonTransactionSupport.inTransaction(conn, () -> {
                long mapId = DungeonRepository.insertMap(conn, name);
                DungeonRoomTopologySupport.createDefaultRoom(conn, mapId);
                return mapId;
            });
        }
    }

    public void renameMap(long mapId, String name) throws Exception {
        try (Connection conn = connectionFactory.getConnection()) {
            DungeonRepository.updateMapName(conn, mapId, name);
        }
    }

    public void deleteMap(long mapId) throws Exception {
        try (Connection conn = connectionFactory.getConnection()) {
            DungeonTransactionSupport.inTransaction(conn, () -> {
                DungeonRepository.deleteMap(conn, mapId);
                DungeonRuntimeSupport.repairStoredRuntimeState(conn);
                return null;
            });
        }
    }
}
