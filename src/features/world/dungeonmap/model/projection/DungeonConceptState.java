package features.world.dungeonmap.model.projection;

import features.world.dungeonmap.model.domain.DungeonConceptLevel;
import features.world.dungeonmap.model.domain.DungeonConceptLevelConnection;
import features.world.dungeonmap.model.domain.DungeonConceptPartyProfile;
import features.world.dungeonmap.model.domain.DungeonMap;
import features.world.dungeonmap.model.domain.DungeonRoom;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Read model for the concept representation of the dungeon.
 * It intentionally references the same room entities as grid mode.
 */
public record DungeonConceptState(
        DungeonMap map,
        DungeonConceptPartyProfile partyProfile,
        List<DungeonConceptLevel> levels,
        List<DungeonConceptLevelConnection> connections,
        List<DungeonRoom> rooms,
        List<DungeonConceptCanvasNode> canvasNodes,
        List<DungeonConceptCanvasEdge> canvasEdges
) {
    public DungeonConceptState withCanvasNodes(List<DungeonConceptCanvasNode> updatedNodes) {
        return new DungeonConceptState(
                map,
                partyProfile,
                levels,
                connections,
                rooms,
                updatedNodes == null ? List.of() : List.copyOf(updatedNodes),
                canvasEdges == null ? List.of() : List.copyOf(canvasEdges));
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

    public boolean hasCanvasEdge(Long conceptLevelId, String firstNodeKey, String secondNodeKey) {
        if (conceptLevelId == null || firstNodeKey == null || secondNodeKey == null) {
            return false;
        }
        for (DungeonConceptCanvasEdge edge : canvasEdges == null ? List.<DungeonConceptCanvasEdge>of() : canvasEdges) {
            if (!conceptLevelId.equals(edge.conceptLevelId())) {
                continue;
            }
            if ((edge.fromNodeKey().equals(firstNodeKey) && edge.toNodeKey().equals(secondNodeKey))
                    || (edge.fromNodeKey().equals(secondNodeKey) && edge.toNodeKey().equals(firstNodeKey))) {
                return true;
            }
        }
        return false;
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

    public DungeonRoom findRoom(Long roomId) {
        if (roomId == null) {
            return null;
        }
        for (DungeonRoom room : rooms == null ? List.<DungeonRoom>of() : rooms) {
            if (roomId.equals(room.roomId())) {
                return room;
            }
        }
        return null;
    }

    public DungeonConceptCanvasEdge findEdge(Long edgeId) {
        if (edgeId == null) {
            return null;
        }
        for (DungeonConceptCanvasEdge edge : canvasEdges == null ? List.<DungeonConceptCanvasEdge>of() : canvasEdges) {
            if (edgeId.equals(edge.edgeId())) {
                return edge;
            }
        }
        return null;
    }
}
