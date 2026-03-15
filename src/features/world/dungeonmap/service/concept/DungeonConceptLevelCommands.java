package features.world.dungeonmap.service.concept;

import features.world.dungeonmap.model.domain.DungeonConceptLevel;
import features.world.dungeonmap.model.domain.DungeonConceptNodePosition;
import features.world.dungeonmap.model.domain.DungeonConceptPartyProfile;
import features.world.dungeonmap.model.domain.DungeonRoom;
import features.world.dungeonmap.repository.concept.DungeonConceptLevelRepository;
import features.world.dungeonmap.repository.concept.DungeonConceptNodePositionRepository;
import features.world.dungeonmap.repository.concept.DungeonConceptPartyProfileRepository;
import features.world.dungeonmap.repository.map.DungeonRoomRepository;
import features.world.dungeonmap.repository.map.DungeonSquareRepository;
import features.world.dungeonmap.service.concept.graph.DungeonConceptGraphEdgeCommands;
import features.world.dungeonmap.service.concept.graph.DungeonConceptRoomDeletionCoordinator;
import features.world.dungeonmap.service.editing.DungeonEditingTransactions;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

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
                            0,
                            0);
                    long newLevelId = DungeonConceptLevelRepository.insertLevel(conn, newLevel);
                    previous = new DungeonConceptLevel(newLevelId, mapId, sortOrder, startLevel, startLevel, 1.0, 1.0, 0, 0);
                }
            } else if (safeLevelCount < levels.size()) {
                deleteOrphanedConceptRoomsForRemovedLevels(conn, mapId, levels, safeLevelCount);
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
            int entranceCount,
            int exitCount
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
                    Math.max(0, entranceCount),
                    Math.max(0, exitCount));
            DungeonConceptLevelRepository.updateLevel(conn, updated);
            DungeonConceptGraphEdgeCommands.syncInitialEdgesForLevelPlanUpdate(conn, existing, updated);
        });
    }

    static void updateNodePositions(List<DungeonConceptNodePosition> nodes) throws Exception {
        DungeonEditingTransactions.withConnectionVoid(conn -> DungeonConceptNodePositionRepository.upsertPositions(conn, nodes));
    }

    private static void deleteOrphanedConceptRoomsForRemovedLevels(
            Connection conn,
            long mapId,
            List<DungeonConceptLevel> levels,
            int retainedLevelCount
    ) throws SQLException {
        // Concept and grid are two representations of the same dungeon rooms.
        // Removing levels only deletes room entities that exist solely as empty concept nodes.
        Set<Long> removedLevelIds = new HashSet<>();
        for (DungeonConceptLevel level : levels) {
            if (level != null && level.sortOrder() > retainedLevelCount) {
                removedLevelIds.add(level.conceptLevelId());
            }
        }
        if (removedLevelIds.isEmpty()) {
            return;
        }
        for (DungeonRoom room : DungeonRoomRepository.getRooms(conn, mapId)) {
            if (room == null || room.roomId() == null || room.conceptLevelId() == null) {
                continue;
            }
            if (!removedLevelIds.contains(room.conceptLevelId())) {
                continue;
            }
            if (DungeonSquareRepository.countSquaresForRoom(conn, room.roomId()) == 0) {
                DungeonConceptRoomDeletionCoordinator.deleteConceptRoom(conn, room.conceptLevelId(), room.roomId());
            }
        }
    }
}
