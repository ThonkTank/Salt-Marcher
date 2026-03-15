package features.world.dungeonmap.service.concept;

import features.world.dungeonmap.model.domain.DungeonConceptLevel;
import features.world.dungeonmap.model.domain.DungeonConceptLevelConnection;
import features.world.dungeonmap.repository.concept.DungeonConceptConnectionRepository;
import features.world.dungeonmap.repository.concept.DungeonConceptLevelRepository;
import features.world.dungeonmap.repository.concept.DungeonConceptNodePositionRepository;
import features.world.dungeonmap.service.concept.graph.DungeonConceptGraphEdgeCommands;
import features.world.dungeonmap.service.concept.graph.DungeonConceptNodeKeys;
import features.world.dungeonmap.service.editing.DungeonEditingTransactions;

final class DungeonConceptConnectionCommands {

    private DungeonConceptConnectionCommands() {
    }

    static void addLevelConnection(long sourceLevelId, long targetLevelId) throws Exception {
        DungeonEditingTransactions.inTransactionRollbackOnSqlOrRuntimeVoid(conn -> {
            DungeonConceptLevel sourceLevel = DungeonConceptLevelRepository.findLevel(conn, sourceLevelId)
                    .orElseThrow(() -> new IllegalArgumentException("Unknown source level: " + sourceLevelId));
            DungeonConceptLevel targetLevel = DungeonConceptLevelRepository.findLevel(conn, targetLevelId)
                    .orElseThrow(() -> new IllegalArgumentException("Unknown target level: " + targetLevelId));
            if (!sourceLevel.mapId().equals(targetLevel.mapId())) {
                throw new IllegalArgumentException("Connections must stay inside one dungeon");
            }
            if (sourceLevel.conceptLevelId().equals(targetLevel.conceptLevelId())) {
                throw new IllegalArgumentException("Connections cannot point to the same level");
            }
            long connectionId = DungeonConceptConnectionRepository.insertConnection(conn, new DungeonConceptLevelConnection(
                    null,
                    sourceLevel.mapId(),
                    sourceLevel.conceptLevelId(),
                    targetLevel.conceptLevelId()));
            DungeonConceptGraphEdgeCommands.syncInitialEdgesForNewConnection(conn, new DungeonConceptLevelConnection(
                    connectionId,
                    sourceLevel.mapId(),
                    sourceLevel.conceptLevelId(),
                    targetLevel.conceptLevelId()));
        });
    }

    static void removeLevelConnection(long connectionId) throws Exception {
        DungeonEditingTransactions.inTransactionRollbackOnSqlOrRuntimeVoid(conn -> {
            if (connectionId <= 0) {
                throw new IllegalArgumentException("Unknown connection: " + connectionId);
            }
            DungeonConceptLevelConnection connection = DungeonConceptConnectionRepository.findConnection(conn, connectionId)
                    .orElseThrow(() -> new IllegalArgumentException("Unknown connection: " + connectionId));
            DungeonConceptGraphEdgeCommands.removeEdgesForConnection(conn, connection);
            String nodeKey = DungeonConceptNodeKeys.connection(connectionId);
            DungeonConceptNodePositionRepository.deletePositionsForNode(conn, connection.levelAId(), nodeKey);
            DungeonConceptNodePositionRepository.deletePositionsForNode(conn, connection.levelBId(), nodeKey);
            DungeonConceptConnectionRepository.deleteConnection(conn, connectionId);
        });
    }
}
