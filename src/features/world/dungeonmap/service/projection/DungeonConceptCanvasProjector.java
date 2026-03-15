package features.world.dungeonmap.service.projection;

import features.world.dungeonmap.model.domain.DungeonConceptLevel;
import features.world.dungeonmap.model.domain.DungeonConceptLevelConnection;
import features.world.dungeonmap.model.domain.DungeonConnection;
import features.world.dungeonmap.model.domain.DungeonConceptNodePosition;
import features.world.dungeonmap.model.domain.DungeonConceptNodeType;
import features.world.dungeonmap.model.domain.DungeonRoom;
import features.world.dungeonmap.model.projection.DungeonConceptCanvasEdge;
import features.world.dungeonmap.model.projection.DungeonConceptCanvasNode;
import features.world.dungeonmap.model.projection.DungeonConceptTransitionDirection;
import features.world.dungeonmap.model.projection.DungeonConceptTransitionVariants;
import features.world.dungeonmap.service.concept.graph.DungeonConceptNodeKeys;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

final class DungeonConceptCanvasProjector {

    private DungeonConceptCanvasProjector() {
    }

    static DungeonConceptCanvasProjection project(
            List<DungeonConceptLevel> levels,
            List<DungeonConceptLevelConnection> connections,
            List<DungeonRoom> rooms,
            List<DungeonConnection> graphEdges,
            List<DungeonConceptNodePosition> positions
    ) {
        Map<String, DungeonConceptNodePosition> positionsByKey = new LinkedHashMap<>();
        for (DungeonConceptNodePosition position : positions == null ? List.<DungeonConceptNodePosition>of() : positions) {
            positionsByKey.put(position.conceptLevelId() + ":" + position.nodeKey(), position);
        }

        List<DungeonConceptCanvasNode> result = new ArrayList<>();
        List<DungeonConceptCanvasEdge> edges = new ArrayList<>();
        for (DungeonConceptLevel level : levels == null ? List.<DungeonConceptLevel>of() : levels) {
            Map<String, DungeonConceptCanvasNode> levelNodesByKey = new LinkedHashMap<>();
            for (int entranceIndex = 1; entranceIndex <= level.entranceCount(); entranceIndex++) {
                String nodeKey = DungeonConceptNodeKeys.entrance(entranceIndex);
                DungeonConceptNodePosition position = positionsByKey.get(level.conceptLevelId() + ":" + nodeKey);
                DungeonConceptCanvasNode entranceNode = new DungeonConceptCanvasNode(
                        nodeKey,
                        level.mapId(),
                        level.conceptLevelId(),
                        DungeonConceptNodeType.ENTRANCE,
                        "Eingang " + entranceIndex,
                        "\uD83D\uDEAA",
                        null,
                        null,
                        null,
                        entranceIndex,
                        null,
                        null,
                        null,
                        position == null ? 0 : position.x(),
                        position == null ? 0 : position.y());
                result.add(entranceNode);
                levelNodesByKey.put(entranceNode.nodeKey(), entranceNode);
            }
            for (int exitIndex = 1; exitIndex <= level.exitCount(); exitIndex++) {
                String nodeKey = DungeonConceptNodeKeys.exit(exitIndex);
                DungeonConceptNodePosition position = positionsByKey.get(level.conceptLevelId() + ":" + nodeKey);
                DungeonConceptCanvasNode exitNode = new DungeonConceptCanvasNode(
                        nodeKey,
                        level.mapId(),
                        level.conceptLevelId(),
                        DungeonConceptNodeType.EXIT,
                        "Ausgang " + exitIndex,
                        "\u21D7",
                        null,
                        null,
                        null,
                        exitIndex,
                        null,
                        null,
                        null,
                        position == null ? 0 : position.x(),
                        position == null ? 0 : position.y());
                result.add(exitNode);
                levelNodesByKey.put(exitNode.nodeKey(), exitNode);
            }
            for (DungeonRoom room : rooms == null ? List.<DungeonRoom>of() : rooms) {
                if (!level.conceptLevelId().equals(room.conceptLevelId()) || room.roomId() == null) {
                    continue;
                }
                String nodeKey = DungeonConceptNodeKeys.room(room.roomId());
                DungeonConceptNodePosition position = positionsByKey.get(level.conceptLevelId() + ":" + nodeKey);
                DungeonConceptCanvasNode roomNode = new DungeonConceptCanvasNode(
                        nodeKey,
                        level.mapId(),
                        level.conceptLevelId(),
                        DungeonConceptNodeType.ROOM,
                        room.name(),
                        "",
                        null,
                        null,
                        null,
                        null,
                        null,
                        room.roomId(),
                        null,
                        position == null ? 0 : position.x(),
                        position == null ? 0 : position.y());
                result.add(roomNode);
                levelNodesByKey.put(roomNode.nodeKey(), roomNode);
            }

            List<DungeonConceptLevelConnection> levelConnections = new ArrayList<>();
            for (DungeonConceptLevelConnection connection : connections == null ? List.<DungeonConceptLevelConnection>of() : connections) {
                if (level.conceptLevelId().equals(connection.levelAId()) || level.conceptLevelId().equals(connection.levelBId())) {
                    levelConnections.add(connection);
                }
            }
            levelConnections.sort(Comparator.comparing(DungeonConceptLevelConnection::connectionId));
            for (DungeonConceptLevelConnection connection : levelConnections) {
                Long targetLevelId = connection.otherLevelId(level.conceptLevelId());
                DungeonConceptLevel targetLevel = findLevel(levels, targetLevelId);
                String nodeKey = DungeonConceptNodeKeys.connection(connection.connectionId());
                DungeonConceptNodePosition position = positionsByKey.get(level.conceptLevelId() + ":" + nodeKey);
                DungeonConceptTransitionDirection direction = resolveDirection(level, targetLevel);
                int variantIndex = DungeonConceptTransitionVariants.variantIndex(levelConnections, level.conceptLevelId(), connection);
                int variantCount = DungeonConceptTransitionVariants.variantCount(levelConnections, level.conceptLevelId(), connection);
                DungeonConceptCanvasNode transitionNode = new DungeonConceptCanvasNode(
                        nodeKey,
                        level.mapId(),
                        level.conceptLevelId(),
                        DungeonConceptNodeType.LEVEL_TRANSITION,
                        targetLevel == null ? null : targetLevel.displayName(),
                        direction == DungeonConceptTransitionDirection.UP ? "\uD83E\uDE9C\u2191" : "\uD83E\uDE9C\u2193",
                        direction,
                        variantIndex,
                        variantCount,
                        null,
                        connection.connectionId(),
                        null,
                        targetLevelId,
                        position == null ? 0 : position.x(),
                        position == null ? 0 : position.y());
                result.add(transitionNode);
                levelNodesByKey.put(transitionNode.nodeKey(), transitionNode);
            }
            for (DungeonConnection graphEdge : graphEdges == null ? List.<DungeonConnection>of() : graphEdges) {
                if (!level.conceptLevelId().equals(graphEdge.conceptLevelId())) {
                    continue;
                }
                if (!levelNodesByKey.containsKey(graphEdge.leftNodeKey()) || !levelNodesByKey.containsKey(graphEdge.rightNodeKey())) {
                    continue;
                }
                edges.add(new DungeonConceptCanvasEdge(
                        graphEdge.connectionId(),
                        level.conceptLevelId(),
                        graphEdge.leftNodeKey(),
                        graphEdge.rightNodeKey()));
            }
        }
        return new DungeonConceptCanvasProjection(List.copyOf(result), List.copyOf(edges));
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

    private static DungeonConceptTransitionDirection resolveDirection(
            DungeonConceptLevel sourceLevel,
            DungeonConceptLevel targetLevel
    ) {
        if (sourceLevel == null || targetLevel == null) {
            return DungeonConceptTransitionDirection.DOWN;
        }
        return targetLevel.sortOrder() < sourceLevel.sortOrder()
                ? DungeonConceptTransitionDirection.UP
                : DungeonConceptTransitionDirection.DOWN;
    }
}
