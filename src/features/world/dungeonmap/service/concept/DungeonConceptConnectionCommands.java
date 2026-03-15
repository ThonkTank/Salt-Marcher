package features.world.dungeonmap.service.concept;

import features.world.dungeonmap.model.domain.DungeonConceptLevel;
import features.world.dungeonmap.model.domain.DungeonConceptLevelConnection;
import features.world.dungeonmap.repository.concept.DungeonConceptConnectionRepository;
import features.world.dungeonmap.repository.concept.DungeonConceptLevelRepository;
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
            if (DungeonConceptConnectionRepository.findExistingConnection(
                    conn,
                    sourceLevel.mapId(),
                    sourceLevel.conceptLevelId(),
                    targetLevel.conceptLevelId()).isPresent()) {
                return;
            }
            DungeonConceptConnectionRepository.insertConnection(conn, new DungeonConceptLevelConnection(
                    null,
                    sourceLevel.mapId(),
                    sourceLevel.conceptLevelId(),
                    targetLevel.conceptLevelId()));
        });
    }

    static void removeLevelConnection(long sourceLevelId, long targetLevelId) throws Exception {
        DungeonEditingTransactions.inTransactionRollbackOnSqlOrRuntimeVoid(conn -> {
            DungeonConceptLevel sourceLevel = DungeonConceptLevelRepository.findLevel(conn, sourceLevelId)
                    .orElseThrow(() -> new IllegalArgumentException("Unknown source level: " + sourceLevelId));
            DungeonConceptLevel targetLevel = DungeonConceptLevelRepository.findLevel(conn, targetLevelId)
                    .orElseThrow(() -> new IllegalArgumentException("Unknown target level: " + targetLevelId));
            if (!sourceLevel.mapId().equals(targetLevel.mapId())) {
                throw new IllegalArgumentException("Connections must stay inside one dungeon");
            }
            DungeonConceptConnectionRepository.deleteConnectionBetween(conn, sourceLevel.mapId(), sourceLevelId, targetLevelId);
        });
    }
}
