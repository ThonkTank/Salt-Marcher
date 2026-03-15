package features.world.dungeonmap.service.projection;

import features.world.dungeonmap.model.domain.DungeonConceptLevel;
import features.world.dungeonmap.model.domain.DungeonConceptLevelConnection;
import features.world.dungeonmap.model.domain.DungeonConceptNodePosition;
import features.world.dungeonmap.model.domain.DungeonConceptNodeType;
import features.world.dungeonmap.model.projection.DungeonConceptCanvasNode;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

final class DungeonConceptCanvasProjector {

    private DungeonConceptCanvasProjector() {
    }

    static List<DungeonConceptCanvasNode> project(
            List<DungeonConceptLevel> levels,
            List<DungeonConceptLevelConnection> connections,
            List<DungeonConceptNodePosition> positions
    ) {
        Map<String, DungeonConceptNodePosition> positionsByKey = new LinkedHashMap<>();
        for (DungeonConceptNodePosition position : positions == null ? List.<DungeonConceptNodePosition>of() : positions) {
            positionsByKey.put(position.conceptLevelId() + ":" + position.nodeKey(), position);
        }

        List<DungeonConceptCanvasNode> result = new ArrayList<>();
        for (DungeonConceptLevel level : levels == null ? List.<DungeonConceptLevel>of() : levels) {
            for (int entranceIndex = 1; entranceIndex <= level.entranceCount(); entranceIndex++) {
                String nodeKey = "entrance:" + entranceIndex;
                DungeonConceptNodePosition position = positionsByKey.get(level.conceptLevelId() + ":" + nodeKey);
                result.add(new DungeonConceptCanvasNode(
                        nodeKey,
                        level.mapId(),
                        level.conceptLevelId(),
                        DungeonConceptNodeType.ENTRANCE,
                        "Eingang " + entranceIndex,
                        entranceIndex,
                        null,
                        null,
                        position == null ? 0 : position.x(),
                        position == null ? 0 : position.y()));
            }

            List<DungeonConceptLevelConnection> levelConnections = new ArrayList<>();
            for (DungeonConceptLevelConnection connection : connections == null ? List.<DungeonConceptLevelConnection>of() : connections) {
                if (level.conceptLevelId().equals(connection.levelAId()) || level.conceptLevelId().equals(connection.levelBId())) {
                    levelConnections.add(connection);
                }
            }
            levelConnections.sort(java.util.Comparator.comparing(DungeonConceptLevelConnection::connectionId));
            for (DungeonConceptLevelConnection connection : levelConnections) {
                Long targetLevelId = connection.otherLevelId(level.conceptLevelId());
                DungeonConceptLevel targetLevel = findLevel(levels, targetLevelId);
                String nodeKey = "connection:" + connection.connectionId();
                DungeonConceptNodePosition position = positionsByKey.get(level.conceptLevelId() + ":" + nodeKey);
                result.add(new DungeonConceptCanvasNode(
                        nodeKey,
                        level.mapId(),
                        level.conceptLevelId(),
                        DungeonConceptNodeType.LEVEL_TRANSITION,
                        targetLevel == null ? "Ebenenwechsel" : "Zu " + targetLevel.displayName(),
                        null,
                        connection.connectionId(),
                        targetLevelId,
                        position == null ? 0 : position.x(),
                        position == null ? 0 : position.y()));
            }
        }
        return List.copyOf(result);
    }

    private static DungeonConceptLevel findLevel(List<DungeonConceptLevel> levels, Long conceptLevelId) {
        if (conceptLevelId == null || levels == null) {
            return null;
        }
        for (DungeonConceptLevel level : levels) {
            if (conceptLevelId.equals(level.conceptLevelId())) {
                return level;
            }
        }
        return null;
    }
}
