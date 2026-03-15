package features.world.dungeonmap.service;

import features.world.dungeonmap.model.domain.DungeonConceptNodePosition;
import features.world.dungeonmap.service.concept.DungeonConceptEditingService;

import java.util.List;

public final class DungeonConceptCommandService {

    public void ensureInitialized(long mapId) throws Exception {
        DungeonConceptEditingService.ensureInitialized(mapId);
    }

    public void updateLevelCount(long mapId, int levelCount) throws Exception {
        DungeonConceptEditingService.updateLevelCount(mapId, levelCount);
    }

    public void updatePartySize(long mapId, int partySize) throws Exception {
        DungeonConceptEditingService.updatePartySize(mapId, partySize);
    }

    public void updateLevelPlan(
            long conceptLevelId,
            int startLevel,
            int endLevel,
            double progressFraction,
            double adventuringDaysTarget,
            int entranceCount,
            int exitCount
    ) throws Exception {
        DungeonConceptEditingService.updateLevelPlan(
                conceptLevelId,
                startLevel,
                endLevel,
                progressFraction,
                adventuringDaysTarget,
                entranceCount,
                exitCount);
    }

    public void addLevelConnection(long sourceLevelId, long targetLevelId) throws Exception {
        DungeonConceptEditingService.addLevelConnection(sourceLevelId, targetLevelId);
    }

    public void removeLevelConnection(long connectionId) throws Exception {
        DungeonConceptEditingService.removeLevelConnection(connectionId);
    }

    public void addGraphEdge(long conceptLevelId, String firstNodeKey, String secondNodeKey) throws Exception {
        DungeonConceptEditingService.addGraphEdge(conceptLevelId, firstNodeKey, secondNodeKey);
    }

    public void removeGraphEdge(long edgeId) throws Exception {
        DungeonConceptEditingService.removeGraphEdge(edgeId);
    }

    public void deleteCanvasNode(long conceptLevelId, String nodeKey) throws Exception {
        DungeonConceptEditingService.deleteCanvasNode(conceptLevelId, nodeKey);
    }

    public void splitGraphEdge(long edgeId, double x, double y) throws Exception {
        DungeonConceptEditingService.splitGraphEdge(edgeId, x, y);
    }

    public void createRoomNodeAt(long conceptLevelId, double x, double y) throws Exception {
        DungeonConceptEditingService.createRoomNodeAt(conceptLevelId, x, y);
    }

    public void updateNodePositions(List<DungeonConceptNodePosition> nodes) throws Exception {
        DungeonConceptEditingService.updateNodePositions(nodes);
    }
}
