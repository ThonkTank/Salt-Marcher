package features.world.dungeonmap.model.projection;

import features.world.dungeonmap.model.domain.DungeonConceptLevel;
import features.world.dungeonmap.model.domain.DungeonConceptLevelConnection;
import features.world.dungeonmap.model.domain.DungeonConceptPartyProfile;
import features.world.dungeonmap.model.domain.DungeonMap;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public record DungeonConceptState(
        DungeonMap map,
        DungeonConceptPartyProfile partyProfile,
        List<DungeonConceptLevel> levels,
        List<DungeonConceptLevelConnection> connections,
        List<DungeonConceptCanvasNode> canvasNodes
) {
    public DungeonConceptState withCanvasNodes(List<DungeonConceptCanvasNode> updatedNodes) {
        return new DungeonConceptState(map, partyProfile, levels, connections, updatedNodes == null ? List.of() : List.copyOf(updatedNodes));
    }

    public DungeonConceptCanvasNode findNode(String nodeKey, Long conceptLevelId) {
        if (nodeKey == null || conceptLevelId == null) {
            return null;
        }
        return nodesByKey().get(conceptLevelId + ":" + nodeKey);
    }

    public DungeonConceptLevel findLevel(Long conceptLevelId) {
        if (conceptLevelId == null) {
            return null;
        }
        return levelsById().get(conceptLevelId);
    }

    public Map<String, DungeonConceptCanvasNode> nodesByKey() {
        Map<String, DungeonConceptCanvasNode> result = new LinkedHashMap<>();
        for (DungeonConceptCanvasNode node : canvasNodes == null ? List.<DungeonConceptCanvasNode>of() : canvasNodes) {
            result.put(node.conceptLevelId() + ":" + node.nodeKey(), node);
        }
        return result;
    }

    public Map<Long, DungeonConceptLevel> levelsById() {
        Map<Long, DungeonConceptLevel> result = new LinkedHashMap<>();
        for (DungeonConceptLevel level : levels == null ? List.<DungeonConceptLevel>of() : levels) {
            if (level.conceptLevelId() != null) {
                result.put(level.conceptLevelId(), level);
            }
        }
        return result;
    }
}
