package features.world.dungeonmap.service.concept;

import features.world.dungeonmap.model.domain.DungeonConceptLevel;
import features.world.dungeonmap.model.domain.DungeonConceptNodePosition;
import features.world.dungeonmap.model.domain.DungeonConceptPartyProfile;
import features.world.dungeonmap.repository.concept.DungeonConceptLevelRepository;
import features.world.dungeonmap.repository.concept.DungeonConceptNodePositionRepository;
import features.world.dungeonmap.repository.concept.DungeonConceptPartyProfileRepository;
import features.world.dungeonmap.service.editing.DungeonEditingTransactions;

import java.util.List;

final class DungeonConceptLevelCommands {

    private DungeonConceptLevelCommands() {
    }

    static void updateLevelCount(long mapId, int levelCount) throws Exception {
        int safeLevelCount = Math.max(1, levelCount);
        DungeonEditingTransactions.inTransactionRollbackOnSqlOrRuntimeVoid(conn -> {
            DungeonConceptSeedOperations.ensureSeedData(conn, mapId);
            List<DungeonConceptLevel> levels = DungeonConceptLevelRepository.getLevels(conn, mapId);
            if (safeLevelCount > levels.size()) {
                DungeonConceptLevel previous = levels.get(levels.size() - 1);
                for (int sortOrder = levels.size() + 1; sortOrder <= safeLevelCount; sortOrder++) {
                    int startLevel = Math.min(20, previous.endLevel() + 1);
                    DungeonConceptLevel newLevel = new DungeonConceptLevel(
                            null,
                            mapId,
                            sortOrder,
                            startLevel,
                            startLevel,
                            1.0,
                            1.0,
                            0);
                    long newLevelId = DungeonConceptLevelRepository.insertLevel(conn, newLevel);
                    previous = new DungeonConceptLevel(newLevelId, mapId, sortOrder, startLevel, startLevel, 1.0, 1.0, 0);
                }
            } else if (safeLevelCount < levels.size()) {
                DungeonConceptLevelRepository.deleteLevelsAfterSortOrder(conn, mapId, safeLevelCount);
            }
        });
    }

    static void updatePartySize(long mapId, int partySize) throws Exception {
        DungeonEditingTransactions.withConnectionVoid(conn ->
                DungeonConceptPartyProfileRepository.upsert(conn,
                        new DungeonConceptPartyProfile(mapId, Math.max(1, partySize))));
    }

    static void updateLevelPlan(
            long conceptLevelId,
            int startLevel,
            int endLevel,
            double progressFraction,
            double adventuringDaysTarget,
            int entranceCount
    ) throws Exception {
        DungeonEditingTransactions.inTransactionRollbackOnSqlOrRuntimeVoid(conn -> {
            DungeonConceptLevel existing = DungeonConceptLevelRepository.findLevel(conn, conceptLevelId)
                    .orElseThrow(() -> new IllegalArgumentException("Unknown concept level: " + conceptLevelId));
            DungeonConceptLevel updated = new DungeonConceptLevel(
                    existing.conceptLevelId(),
                    existing.mapId(),
                    existing.sortOrder(),
                    startLevel,
                    endLevel,
                    Math.max(0.0, progressFraction),
                    Math.max(0.0, adventuringDaysTarget),
                    Math.max(0, entranceCount));
            DungeonConceptLevelRepository.updateLevel(conn, updated);
        });
    }

    static void updateNodePositions(List<DungeonConceptNodePosition> nodes) throws Exception {
        DungeonEditingTransactions.withConnectionVoid(conn -> DungeonConceptNodePositionRepository.upsertPositions(conn, nodes));
    }
}
