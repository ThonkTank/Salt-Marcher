package src.domain.dungeon.map.value;

public record DungeonTopologyRef(
        DungeonTopologyElementKind kind,
        long id
) {

    public DungeonTopologyRef {
        kind = kind == null ? DungeonTopologyElementKind.EMPTY : kind;
        id = Math.max(0L, id);
    }

    public static DungeonTopologyRef empty() {
        return new DungeonTopologyRef(DungeonTopologyElementKind.EMPTY, 0L);
    }

    public boolean present() {
        return kind != DungeonTopologyElementKind.EMPTY && id > 0L;
    }
}
