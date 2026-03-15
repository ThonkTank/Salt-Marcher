package features.world.dungeonmap.service.concept;

import features.world.dungeonmap.model.domain.DungeonConceptNodePosition;
import features.world.dungeonmap.service.concept.graph.DungeonConceptGraphEdgeCommands;
import features.world.dungeonmap.service.concept.graph.DungeonConceptGraphNodeCommands;

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
            int entranceCount,
            int exitCount
    ) throws Exception {
        DungeonConceptLevelCommands.updateLevelPlan(
                conceptLevelId,
                startLevel,
                endLevel,
                progressFraction,
                adventuringDaysTarget,
                entranceCount,
                exitCount);
    }

    public static void addLevelConnection(long sourceLevelId, long targetLevelId) throws Exception {
        DungeonConceptConnectionCommands.addLevelConnection(sourceLevelId, targetLevelId);
    }

    public static void removeLevelConnection(long connectionId) throws Exception {
        DungeonConceptConnectionCommands.removeLevelConnection(connectionId);
    }

    public static void addGraphEdge(long conceptLevelId, String firstNodeKey, String secondNodeKey) throws Exception {
        DungeonConceptGraphEdgeCommands.addGraphEdge(conceptLevelId, firstNodeKey, secondNodeKey);
    }

    public static void removeGraphEdge(long edgeId) throws Exception {
        DungeonConceptGraphEdgeCommands.removeGraphEdge(edgeId);
    }

    public static void deleteCanvasNode(long conceptLevelId, String nodeKey) throws Exception {
        DungeonConceptGraphNodeCommands.deleteCanvasNode(conceptLevelId, nodeKey);
    }

    public static void splitGraphEdge(long edgeId, double x, double y) throws Exception {
        DungeonConceptGraphNodeCommands.splitEdgeWithRoom(edgeId, x, y);
    }

    public static void createRoomNodeAt(long conceptLevelId, double x, double y) throws Exception {
        DungeonConceptGraphNodeCommands.createRoomNodeAt(conceptLevelId, x, y);
    }

    public static void updateNodePositions(List<DungeonConceptNodePosition> nodes) throws Exception {
        DungeonConceptLevelCommands.updateNodePositions(nodes);
    }
}
