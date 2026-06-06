package src.data.dungeon.mapper;

import java.util.List;
import src.data.dungeon.model.DungeonCorridorRecord;
import src.data.dungeon.model.DungeonMapRecord;
import src.data.dungeon.model.DungeonStairRecord;
import src.data.dungeon.model.DungeonTransitionRecord;
import src.domain.dungeon.model.worldspace.ConnectionCatalog;

final class DungeonConnectionRecordMapper {

    private DungeonConnectionRecordMapper() {
    }

    static ConnectionCatalog toConnectionCatalog(DungeonMapRecord record) {
        return new ConnectionCatalog(
                DungeonCorridorConnectionReadMapperSupport.toCorridors(record.corridors()),
                DungeonStairRecordMapperSupport.toStairs(record.stairs()),
                DungeonTransitionRecordMapperSupport.toTransitions(record.transitions()));
    }

    static List<DungeonCorridorRecord> toCorridorRecords(ConnectionCatalog connections) {
        return DungeonCorridorConnectionWriteMapperSupport.toCorridorRecords(
                connections == null ? List.of() : connections.corridors());
    }

    static List<DungeonStairRecord> toStairRecords(ConnectionCatalog connections) {
        return DungeonStairRecordMapperSupport.toStairRecords(
                connections == null ? null : connections.stairs());
    }

    static List<DungeonTransitionRecord> toTransitionRecords(ConnectionCatalog connections) {
        return DungeonTransitionRecordMapperSupport.toTransitionRecords(
                connections == null ? List.of() : connections.transitions());
    }
}
