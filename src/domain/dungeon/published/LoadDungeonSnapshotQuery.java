package src.domain.dungeon.published;

public record LoadDungeonSnapshotQuery(
        DungeonMapId mapId
) {

    public LoadDungeonSnapshotQuery() {
        this(new DungeonMapId(1L));
    }

    public LoadDungeonSnapshotQuery {
        mapId = mapId == null ? new DungeonMapId(1L) : mapId;
    }
}
