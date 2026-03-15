package features.world.dungeonmap.service.concept.graph;

import features.world.dungeonmap.model.domain.DungeonConnection;
import features.world.dungeonmap.model.domain.DungeonConceptLevel;
import features.world.dungeonmap.model.domain.DungeonConceptLevelConnection;
import features.world.dungeonmap.model.domain.DungeonConceptNodePosition;
import features.world.dungeonmap.model.domain.DungeonConceptNodeType;
import features.world.dungeonmap.model.domain.DungeonRoom;
import features.world.dungeonmap.repository.concept.DungeonConceptConnectionRepository;
import features.world.dungeonmap.repository.concept.DungeonConceptLevelRepository;
import features.world.dungeonmap.repository.concept.DungeonConceptNodePositionRepository;
import features.world.dungeonmap.repository.connection.DungeonConnectionRepository;
import features.world.dungeonmap.repository.map.DungeonRoomRepository;
import features.world.dungeonmap.repository.map.DungeonSquareRepository;
import features.world.dungeonmap.service.editing.DungeonEditingTransactions;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class DungeonConceptGraphNodeCommands {

    private static final Pattern DEFAULT_ROOM_NAME = Pattern.compile("^Raum #(\\d+)$");

    private DungeonConceptGraphNodeCommands() {
    }

    public static void deleteCanvasNode(long conceptLevelId, String nodeKey) throws Exception {
        DungeonEditingTransactions.inTransactionRollbackOnSqlOrRuntimeVoid(conn -> {
            DungeonConceptLevel level = DungeonConceptLevelRepository.findLevel(conn, conceptLevelId)
                    .orElseThrow(() -> new IllegalArgumentException("Unknown concept level: " + conceptLevelId));
            DungeonConceptGraphEdgeCommands.validateNodeExists(conn, level, nodeKey);
            if (DungeonConceptNodeKeys.isEntrance(nodeKey)) {
                deleteIndexedExternalNode(conn, level, nodeKey, true);
                return;
            }
            if (DungeonConceptNodeKeys.isExit(nodeKey)) {
                deleteIndexedExternalNode(conn, level, nodeKey, false);
                return;
            }
            if (DungeonConceptNodeKeys.isConnection(nodeKey)) {
                removeTransitionNode(conn, DungeonConceptNodeKeys.connectionId(nodeKey));
                return;
            }
            if (DungeonConceptNodeKeys.isRoom(nodeKey)) {
                deleteRoomNode(conn, level, DungeonConceptNodeKeys.roomId(nodeKey));
                return;
            }
            throw new IllegalArgumentException("Unknown concept node: " + nodeKey);
        });
    }

    public static void splitEdgeWithRoom(long edgeId, double x, double y) throws Exception {
        DungeonEditingTransactions.inTransactionRollbackOnSqlOrRuntimeVoid(conn -> {
            DungeonConnection edge = DungeonConnectionRepository.findConnection(conn, edgeId)
                    .orElseThrow(() -> new IllegalArgumentException("Unknown concept edge: " + edgeId));
            DungeonConceptLevel level = DungeonConceptLevelRepository.findLevel(conn, edge.conceptLevelId())
                    .orElseThrow(() -> new IllegalArgumentException("Unknown concept level: " + edge.conceptLevelId()));
            DungeonConceptGraphEdgeCommands.validateNodeExists(conn, level, edge.leftNodeKey());
            DungeonConceptGraphEdgeCommands.validateNodeExists(conn, level, edge.rightNodeKey());

            long roomId = createEmptyRoomNode(conn, level);
            String roomNodeKey = DungeonConceptNodeKeys.room(roomId);

            DungeonConnectionRepository.deleteConnection(conn, edge.connectionId());
            DungeonConnectionRepository.insertConnectionsIgnoreDuplicates(conn, List.of(
                    DungeonConnection.ordered(null, level.mapId(), level.conceptLevelId(), edge.leftNodeKey(), roomNodeKey),
                    DungeonConnection.ordered(null, level.mapId(), level.conceptLevelId(), roomNodeKey, edge.rightNodeKey())));
            DungeonConceptNodePositionRepository.upsertPositions(conn, List.of(new DungeonConceptNodePosition(
                    null,
                    level.mapId(),
                    level.conceptLevelId(),
                    roomNodeKey,
                    DungeonConceptNodeType.ROOM,
                    null,
                    null,
                    x,
                    y)));
        });
    }

    public static void createRoomNodeAt(long conceptLevelId, double x, double y) throws Exception {
        DungeonEditingTransactions.inTransactionRollbackOnSqlOrRuntimeVoid(conn -> {
            DungeonConceptLevel level = DungeonConceptLevelRepository.findLevel(conn, conceptLevelId)
                    .orElseThrow(() -> new IllegalArgumentException("Unknown concept level: " + conceptLevelId));
            long roomId = createEmptyRoomNode(conn, level);
            DungeonConceptNodePositionRepository.upsertPositions(conn, List.of(new DungeonConceptNodePosition(
                    null,
                    level.mapId(),
                    level.conceptLevelId(),
                    DungeonConceptNodeKeys.room(roomId),
                    DungeonConceptNodeType.ROOM,
                    null,
                    null,
                    x,
                    y)));
        });
    }

    private static void deleteIndexedExternalNode(
            Connection conn,
            DungeonConceptLevel level,
            String nodeKey,
            boolean entrance
    ) throws SQLException {
        int removedIndex = entrance
                ? DungeonConceptNodeKeys.entranceIndex(nodeKey)
                : DungeonConceptNodeKeys.exitIndex(nodeKey);
        int currentCount = entrance ? level.entranceCount() : level.exitCount();
        DungeonConnectionRepository.deleteConnectionsForNode(conn, level.conceptLevelId(), nodeKey);
        DungeonConceptNodePositionRepository.deletePositionsForNode(conn, level.conceptLevelId(), nodeKey);
        for (int currentIndex = removedIndex + 1; currentIndex <= currentCount; currentIndex++) {
            String previousKey = entrance
                    ? DungeonConceptNodeKeys.entrance(currentIndex)
                    : DungeonConceptNodeKeys.exit(currentIndex);
            String updatedKey = entrance
                    ? DungeonConceptNodeKeys.entrance(currentIndex - 1)
                    : DungeonConceptNodeKeys.exit(currentIndex - 1);
            rekeyNode(conn, level.mapId(), level.conceptLevelId(), previousKey, updatedKey, entrance ? currentIndex - 1 : null);
        }
        DungeonConceptLevelRepository.updateLevel(conn, new DungeonConceptLevel(
                level.conceptLevelId(),
                level.mapId(),
                level.sortOrder(),
                level.startLevel(),
                level.endLevel(),
                level.progressFraction(),
                level.adventuringDaysTarget(),
                entrance ? currentCount - 1 : level.entranceCount(),
                entrance ? level.exitCount() : currentCount - 1));
    }

    private static void removeTransitionNode(Connection conn, long connectionId) throws SQLException {
        DungeonConceptLevelConnection connection = DungeonConceptConnectionRepository.findConnection(conn, connectionId)
                .orElseThrow(() -> new IllegalArgumentException("Unknown connection: " + connectionId));
        DungeonConceptGraphEdgeCommands.removeEdgesForConnection(conn, connection);
        DungeonConceptNodePositionRepository.deletePositionsForNode(conn, connection.levelAId(), DungeonConceptNodeKeys.connection(connectionId));
        DungeonConceptNodePositionRepository.deletePositionsForNode(conn, connection.levelBId(), DungeonConceptNodeKeys.connection(connectionId));
        DungeonConceptConnectionRepository.deleteConnection(conn, connectionId);
    }

    private static void deleteRoomNode(Connection conn, DungeonConceptLevel level, long roomId) throws SQLException {
        DungeonRoom room = DungeonRoomRepository.findRoom(conn, roomId)
                .orElseThrow(() -> new IllegalArgumentException("Unknown room: " + roomId));
        if (!level.mapId().equals(room.mapId()) || !level.conceptLevelId().equals(room.conceptLevelId())) {
            throw new IllegalArgumentException("Room belongs to another level");
        }
        if (DungeonSquareRepository.countSquaresForRoom(conn, roomId) > 0) {
            throw new IllegalStateException("Raum mit gezeichneten Feldern kann hier nicht geloescht werden.");
        }
        DungeonConceptRoomDeletionCoordinator.deleteConceptRoom(conn, level.conceptLevelId(), roomId);
    }

    private static long createEmptyRoomNode(Connection conn, DungeonConceptLevel level) throws SQLException {
        return DungeonRoomRepository.upsertRoom(conn, new DungeonRoom(
                null,
                level.mapId(),
                nextRoomName(DungeonRoomRepository.getRooms(conn, level.mapId())),
                "",
                "",
                "",
                "",
                "",
                "",
                "",
                "",
                "",
                null,
                level.conceptLevelId()));
    }

    private static void rekeyNode(
            Connection conn,
            long mapId,
            long conceptLevelId,
            String previousKey,
            String updatedKey,
            Integer updatedExternalNodeIndex
    ) throws SQLException {
        List<DungeonConnection> rewrittenEdges = new ArrayList<>();
        for (DungeonConnection edge : DungeonConnectionRepository.getConnections(conn, mapId)) {
            if (!conceptLevelIdEquals(conceptLevelId, edge.conceptLevelId())) {
                continue;
            }
            if (!previousKey.equals(edge.leftNodeKey()) && !previousKey.equals(edge.rightNodeKey())) {
                continue;
            }
            DungeonConnectionRepository.deleteConnection(conn, edge.connectionId());
            String leftNodeKey = previousKey.equals(edge.leftNodeKey()) ? updatedKey : edge.leftNodeKey();
            String rightNodeKey = previousKey.equals(edge.rightNodeKey()) ? updatedKey : edge.rightNodeKey();
            rewrittenEdges.add(DungeonConnection.ordered(null, edge.mapId(), edge.conceptLevelId(), leftNodeKey, rightNodeKey));
        }
        DungeonConnectionRepository.insertConnectionsIgnoreDuplicates(conn, rewrittenEdges);

        for (DungeonConceptNodePosition position : DungeonConceptNodePositionRepository.getPositions(conn, mapId)) {
            if (!conceptLevelIdEquals(conceptLevelId, position.conceptLevelId()) || !previousKey.equals(position.nodeKey())) {
                continue;
            }
            DungeonConceptNodePositionRepository.upsertPositions(conn, List.of(new DungeonConceptNodePosition(
                    null,
                    position.mapId(),
                    position.conceptLevelId(),
                    updatedKey,
                    position.nodeType(),
                    updatedExternalNodeIndex,
                    position.connectionId(),
                    position.x(),
                    position.y())));
            DungeonConceptNodePositionRepository.deletePosition(conn, position.conceptPositionId());
        }
    }

    private static String nextRoomName(List<DungeonRoom> rooms) {
        int nextRoomNumber = 1;
        for (DungeonRoom room : rooms == null ? List.<DungeonRoom>of() : rooms) {
            if (room == null || room.name() == null) {
                continue;
            }
            Matcher matcher = DEFAULT_ROOM_NAME.matcher(room.name().trim());
            if (matcher.matches()) {
                nextRoomNumber = Math.max(nextRoomNumber, Integer.parseInt(matcher.group(1)) + 1);
            }
        }
        return "Raum #" + nextRoomNumber;
    }

    private static boolean conceptLevelIdEquals(long expectedConceptLevelId, Long actualConceptLevelId) {
        return actualConceptLevelId != null && actualConceptLevelId == expectedConceptLevelId;
    }
}
