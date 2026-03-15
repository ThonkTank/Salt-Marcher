package features.world.dungeonmap.service.concept;

import features.world.dungeonmap.model.domain.DungeonConceptLevel;
import features.world.dungeonmap.model.domain.DungeonConceptPartyProfile;
import features.world.dungeonmap.repository.concept.DungeonConceptLevelRepository;
import features.world.dungeonmap.repository.concept.DungeonConceptPartyProfileRepository;
import features.world.dungeonmap.service.editing.DungeonEditingTransactions;

import java.sql.Connection;
import java.util.List;

final class DungeonConceptSeedOperations {

    private DungeonConceptSeedOperations() {
    }

    static void ensureInitialized(long mapId) throws Exception {
        DungeonEditingTransactions.inTransactionRollbackOnSqlOrRuntimeVoid(conn -> ensureSeedData(conn, mapId));
    }

    static void ensureSeedData(Connection conn, long mapId) throws Exception {
        DungeonConceptPartyProfileRepository.upsert(conn,
                DungeonConceptPartyProfileRepository.findByMap(conn, mapId)
                        .orElseGet(() -> new DungeonConceptPartyProfile(mapId, 4)));
        List<DungeonConceptLevel> levels = DungeonConceptLevelRepository.getLevels(conn, mapId);
        if (levels.isEmpty()) {
            DungeonConceptLevelRepository.insertLevel(conn,
                    new DungeonConceptLevel(null, mapId, 1, 1, 1, 1.0, 1.0, 1));
        }
    }
}
