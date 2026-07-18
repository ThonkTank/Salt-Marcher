package features.dungeon.adapter.sqlite.mapper;

import features.dungeon.adapter.sqlite.model.DungeonMapRecord;
import features.dungeon.domain.core.structure.DungeonMap;

/** Test-only conversion used by explicit SQLite fixture seeding. */
public final class DungeonMapRecordFixtureMapper {

    private DungeonMapRecordFixtureMapper() {
    }

    public static DungeonMapRecord toRecord(DungeonMap dungeonMap) {
        return DungeonMapRecordWriteMapperSupport.toRecord(dungeonMap);
    }
}
