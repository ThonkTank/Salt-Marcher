package features.world.dungeonmap.service.concept.graph;

import features.world.dungeonmap.model.domain.DungeonConnection;
import features.world.dungeonmap.model.domain.DungeonConceptLevel;
import features.world.dungeonmap.model.domain.DungeonConceptLevelConnection;
import features.world.dungeonmap.model.domain.DungeonConceptNodeType;
import features.world.dungeonmap.model.domain.DungeonRoom;
import features.world.dungeonmap.repository.concept.DungeonConceptConnectionRepository;
import features.world.dungeonmap.repository.concept.DungeonConceptLevelRepository;
import features.world.dungeonmap.repository.concept.DungeonConceptNodePositionRepository;
import features.world.dungeonmap.repository.connection.DungeonConnectionRepository;
import features.world.dungeonmap.repository.map.DungeonRoomRepository;
import features.world.dungeonmap.service.editing.DungeonEditingTransactions;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

public final class DungeonConceptGraphEdgeCommands {

    private DungeonConceptGraphEdgeCommands() {
    }

    public static void addGraphEdge(long conceptLevelId, String firstNodeKey, String secondNodeKey) throws Exception {
        DungeonEditingTransactions.inTransactionRollbackOnSqlOrRuntimeVoid(conn -> {
            DungeonConceptLevel level = DungeonConceptLevelRepository.findLevel(conn, conceptLevelId)
                    .orElseThrow(() -> new IllegalArgumentException("Unknown concept level: " + conceptLevelId));
            validateNodeExists(conn, level, firstNodeKey);
            validateNodeExists(conn, level, secondNodeKey);
            DungeonConnectionRepository.insertConnectionsIgnoreDuplicates(conn, List.of(
                    DungeonConnection.ordered(null, level.mapId(), level.conceptLevelId(), firstNodeKey, secondNodeKey)));
        });
    }

    public static void removeGraphEdge(long edgeId) throws Exception {
        DungeonEditingTransactions.inTransactionRollbackOnSqlOrRuntimeVoid(conn -> {
            if (edgeId <= 0) {
                throw new IllegalArgumentException("Unknown concept graph edge: " + edgeId);
            }
            DungeonConnectionRepository.deleteConnection(conn, edgeId);
        });
    }

    public static void syncInitialEdgesForLevelPlanUpdate(Connection conn, DungeonConceptLevel previous, DungeonConceptLevel updated) throws SQLException {
        if (previous == null || updated == null) {
            return;
        }
        for (int entranceIndex = updated.entranceCount() + 1; entranceIndex <= previous.entranceCount(); entranceIndex++) {
            String nodeKey = DungeonConceptNodeKeys.entrance(entranceIndex);
            DungeonConnectionRepository.deleteConnectionsForNode(conn, updated.conceptLevelId(), nodeKey);
            DungeonConceptNodePositionRepository.deletePositionsForNode(conn, updated.conceptLevelId(), nodeKey);
        }
        for (int exitIndex = updated.exitCount() + 1; exitIndex <= previous.exitCount(); exitIndex++) {
            String nodeKey = DungeonConceptNodeKeys.exit(exitIndex);
            DungeonConnectionRepository.deleteConnectionsForNode(conn, updated.conceptLevelId(), nodeKey);
            DungeonConceptNodePositionRepository.deletePositionsForNode(conn, updated.conceptLevelId(), nodeKey);
        }

        List<DungeonConceptLevelConnection> allConnections = DungeonConceptConnectionRepository.getConnections(conn, updated.mapId());
        List<String> transitionKeys = transitionNodeKeys(updated.conceptLevelId(), allConnections);
        List<DungeonConnection> initialEdges = new ArrayList<>();
        // These initial links are only seeded for newly created nodes; later manual graph edits own the topology.
        for (int entranceIndex = previous.entranceCount() + 1; entranceIndex <= updated.entranceCount(); entranceIndex++) {
            String nodeKey = DungeonConceptNodeKeys.entrance(entranceIndex);
            for (String transitionKey : transitionKeys) {
                initialEdges.add(DungeonConnection.ordered(null, updated.mapId(), updated.conceptLevelId(), nodeKey, transitionKey));
            }
        }
        for (int exitIndex = previous.exitCount() + 1; exitIndex <= updated.exitCount(); exitIndex++) {
            String nodeKey = DungeonConceptNodeKeys.exit(exitIndex);
            for (String transitionKey : transitionKeys) {
                initialEdges.add(DungeonConnection.ordered(null, updated.mapId(), updated.conceptLevelId(), nodeKey, transitionKey));
            }
        }
        DungeonConnectionRepository.insertConnectionsIgnoreDuplicates(conn, initialEdges);
    }

    public static void syncInitialEdgesForNewConnection(Connection conn, DungeonConceptLevelConnection connection) throws SQLException {
        if (connection == null) {
            return;
        }
        DungeonConceptLevel levelA = DungeonConceptLevelRepository.findLevel(conn, connection.levelAId())
                .orElseThrow(() -> new IllegalArgumentException("Unknown source level for concept connection: " + connection.connectionId()));
        DungeonConceptLevel levelB = DungeonConceptLevelRepository.findLevel(conn, connection.levelBId())
                .orElseThrow(() -> new IllegalArgumentException("Unknown target level for concept connection: " + connection.connectionId()));
        syncInitialEdgesForNewTransitionNode(conn, levelA, DungeonConceptNodeKeys.connection(connection.connectionId()));
        syncInitialEdgesForNewTransitionNode(conn, levelB, DungeonConceptNodeKeys.connection(connection.connectionId()));
    }

    public static void removeEdgesForConnection(Connection conn, DungeonConceptLevelConnection connection) throws SQLException {
        if (connection == null || connection.connectionId() == null) {
            return;
        }
        String transitionNodeKey = DungeonConceptNodeKeys.connection(connection.connectionId());
        DungeonConnectionRepository.deleteConnectionsForNode(conn, connection.levelAId(), transitionNodeKey);
        DungeonConnectionRepository.deleteConnectionsForNode(conn, connection.levelBId(), transitionNodeKey);
    }

    private static void syncInitialEdgesForNewTransitionNode(Connection conn, DungeonConceptLevel level, String transitionNodeKey) throws SQLException {
        List<DungeonConceptLevelConnection> allConnections = DungeonConceptConnectionRepository.getConnections(conn, level.mapId());
        List<DungeonConnection> initialEdges = new ArrayList<>();
        for (int entranceIndex = 1; entranceIndex <= level.entranceCount(); entranceIndex++) {
            initialEdges.add(DungeonConnection.ordered(null, level.mapId(), level.conceptLevelId(), DungeonConceptNodeKeys.entrance(entranceIndex), transitionNodeKey));
        }
        for (int exitIndex = 1; exitIndex <= level.exitCount(); exitIndex++) {
            initialEdges.add(DungeonConnection.ordered(null, level.mapId(), level.conceptLevelId(), DungeonConceptNodeKeys.exit(exitIndex), transitionNodeKey));
        }
        for (String existingTransitionKey : transitionNodeKeys(level.conceptLevelId(), allConnections)) {
            if (!transitionNodeKey.equals(existingTransitionKey)) {
                initialEdges.add(DungeonConnection.ordered(null, level.mapId(), level.conceptLevelId(), existingTransitionKey, transitionNodeKey));
            }
        }
        DungeonConnectionRepository.insertConnectionsIgnoreDuplicates(conn, initialEdges);
    }

    private static List<String> transitionNodeKeys(Long conceptLevelId, List<DungeonConceptLevelConnection> allConnections) {
        List<String> result = new ArrayList<>();
        for (DungeonConceptLevelConnection connection : allConnections) {
            if (conceptLevelId.equals(connection.levelAId()) || conceptLevelId.equals(connection.levelBId())) {
                result.add(DungeonConceptNodeKeys.connection(connection.connectionId()));
            }
        }
        return result;
    }

    public static DungeonConceptNodeType nodeTypeForKey(String nodeKey) {
        if (DungeonConceptNodeKeys.isEntrance(nodeKey)) {
            return DungeonConceptNodeType.ENTRANCE;
        }
        if (DungeonConceptNodeKeys.isExit(nodeKey)) {
            return DungeonConceptNodeType.EXIT;
        }
        if (DungeonConceptNodeKeys.isConnection(nodeKey)) {
            return DungeonConceptNodeType.LEVEL_TRANSITION;
        }
        if (DungeonConceptNodeKeys.isRoom(nodeKey)) {
            return DungeonConceptNodeType.ROOM;
        }
        throw new IllegalArgumentException("Unknown concept canvas node: " + nodeKey);
    }

    public static void validateNodeExists(Connection conn, DungeonConceptLevel level, String nodeKey) throws SQLException {
        if (nodeKey == null || nodeKey.isBlank()) {
            throw new IllegalArgumentException("Concept edge node key must not be blank");
        }
        if (DungeonConceptNodeKeys.isEntrance(nodeKey)) {
            int index = DungeonConceptNodeKeys.entranceIndex(nodeKey);
            if (index < 1 || index > level.entranceCount()) {
                throw new IllegalArgumentException("Unknown concept entrance node: " + nodeKey);
            }
            return;
        }
        if (DungeonConceptNodeKeys.isExit(nodeKey)) {
            int index = DungeonConceptNodeKeys.exitIndex(nodeKey);
            if (index < 1 || index > level.exitCount()) {
                throw new IllegalArgumentException("Unknown concept exit node: " + nodeKey);
            }
            return;
        }
        if (DungeonConceptNodeKeys.isConnection(nodeKey)) {
            long connectionId = DungeonConceptNodeKeys.connectionId(nodeKey);
            for (DungeonConceptLevelConnection connection : DungeonConceptConnectionRepository.getConnections(conn, level.mapId())) {
                if (connectionId == connection.connectionId()
                        && (level.conceptLevelId().equals(connection.levelAId()) || level.conceptLevelId().equals(connection.levelBId()))) {
                    return;
                }
            }
        }
        if (DungeonConceptNodeKeys.isRoom(nodeKey)) {
            long roomId = DungeonConceptNodeKeys.roomId(nodeKey);
            DungeonRoom room = DungeonRoomRepository.findRoom(conn, roomId)
                    .orElseThrow(() -> new IllegalArgumentException("Unknown concept room node: " + nodeKey));
            if (!level.mapId().equals(room.mapId()) || !level.conceptLevelId().equals(room.conceptLevelId())) {
                throw new IllegalArgumentException("Concept room node belongs to another level: " + nodeKey);
            }
            return;
        }
        throw new IllegalArgumentException("Unknown concept canvas node: " + nodeKey);
    }
}
