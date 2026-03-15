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
            int entranceCount
    ) throws Exception {
        DungeonConceptEditingService.updateLevelPlan(
                conceptLevelId,
                startLevel,
                endLevel,
                progressFraction,
                adventuringDaysTarget,
                entranceCount);
    }

    public void addLevelConnection(long sourceLevelId, long targetLevelId) throws Exception {
        DungeonConceptEditingService.addLevelConnection(sourceLevelId, targetLevelId);
    }

    public void removeLevelConnection(long sourceLevelId, long targetLevelId) throws Exception {
        DungeonConceptEditingService.removeLevelConnection(sourceLevelId, targetLevelId);
    }

    public void updateNodePositions(List<DungeonConceptNodePosition> nodes) throws Exception {
        DungeonConceptEditingService.updateNodePositions(nodes);
    }
}
