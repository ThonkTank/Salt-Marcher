package features.world.dungeonmap.service.concept;

import features.world.dungeonmap.model.domain.DungeonConceptNodePosition;

import java.sql.Connection;
import java.util.List;

public final class DungeonConceptEditingService {

    private DungeonConceptEditingService() {
        throw new AssertionError("No instances");
    }

    public static void ensureSeedData(Connection conn, long mapId) throws Exception {
        DungeonConceptSeedOperations.ensureSeedData(conn, mapId);
    }

    public static void ensureInitialized(long mapId) throws Exception {
        DungeonConceptSeedOperations.ensureInitialized(mapId);
    }

    public static void updateLevelCount(long mapId, int levelCount) throws Exception {
        DungeonConceptLevelCommands.updateLevelCount(mapId, levelCount);
    }

    public static void updatePartySize(long mapId, int partySize) throws Exception {
        DungeonConceptLevelCommands.updatePartySize(mapId, partySize);
    }

    public static void updateLevelPlan(
            long conceptLevelId,
            int startLevel,
            int endLevel,
            double progressFraction,
            double adventuringDaysTarget,
            int entranceCount
    ) throws Exception {
        DungeonConceptLevelCommands.updateLevelPlan(
                conceptLevelId,
                startLevel,
                endLevel,
                progressFraction,
                adventuringDaysTarget,
                entranceCount);
    }

    public static void addLevelConnection(long sourceLevelId, long targetLevelId) throws Exception {
        DungeonConceptConnectionCommands.addLevelConnection(sourceLevelId, targetLevelId);
    }

    public static void removeLevelConnection(long sourceLevelId, long targetLevelId) throws Exception {
        DungeonConceptConnectionCommands.removeLevelConnection(sourceLevelId, targetLevelId);
    }

    public static void updateNodePositions(List<DungeonConceptNodePosition> nodes) throws Exception {
        DungeonConceptLevelCommands.updateNodePositions(nodes);
    }
}
