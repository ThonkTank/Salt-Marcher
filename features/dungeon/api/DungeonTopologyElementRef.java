package features.dungeon.api;

public record DungeonTopologyElementRef(
        DungeonTopologyElementKind kind,
        long id
) {

    public DungeonTopologyElementRef {
        kind = kind == null ? DungeonTopologyElementKind.EMPTY : kind;
        id = Math.max(0L, id);
    }

    public static DungeonTopologyElementRef empty() {
        return new DungeonTopologyElementRef(DungeonTopologyElementKind.EMPTY, 0L);
    }
}
