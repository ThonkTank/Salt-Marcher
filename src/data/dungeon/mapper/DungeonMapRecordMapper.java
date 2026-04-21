package src.data.dungeon.mapper;

import src.data.dungeon.model.DungeonMapRecord;
import src.data.dungeon.model.DungeonTopologySeedRecord;
import src.domain.dungeon.map.aggregate.DungeonMap;
import src.domain.dungeon.map.value.DungeonMapIdentity;
import src.domain.dungeon.map.value.DungeonTopology;
import src.domain.dungeon.map.value.SpatialTopology;

/**
 * Maps source-local dungeon rows into the domain aggregate.
 */
public final class DungeonMapRecordMapper {

    private DungeonMapRecordMapper() {
    }

    public static DungeonMap toDomain(DungeonMapRecord record) {
        DungeonMapRecord resolvedRecord = record == null
                ? new DungeonMapRecord(1L, "Dungeon Bastion", 1L, DungeonTopologySeedRecord.demo())
                : record;
        DungeonTopologySeedRecord seed = resolvedRecord.topologySeed();
        return DungeonMap.authored(
                new DungeonMapIdentity(resolvedRecord.mapId()),
                resolvedRecord.name(),
                new SpatialTopology(
                        DungeonTopology.SQUARE,
                        seed.width(),
                        seed.height(),
                        seed.roomAnchorQ(),
                        seed.roomAnchorR()),
                resolvedRecord.revision());
    }

    public static DungeonMapRecord toRecord(DungeonMap dungeonMap) {
        SpatialTopology topology = dungeonMap == null ? SpatialTopology.demo() : dungeonMap.topology();
        return new DungeonMapRecord(
                dungeonMap == null ? 1L : dungeonMap.metadata().mapId().value(),
                dungeonMap == null ? "Dungeon Bastion" : dungeonMap.metadata().mapName(),
                dungeonMap == null ? 1L : dungeonMap.revision(),
                new DungeonTopologySeedRecord(
                        topology.width(),
                        topology.height(),
                        topology.roomAnchorQ(),
                        topology.roomAnchorR()));
    }
}
