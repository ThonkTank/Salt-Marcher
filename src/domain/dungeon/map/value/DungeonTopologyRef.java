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

    public static DungeonTopologyRef door(long id) {
        return new DungeonTopologyRef(DungeonTopologyElementKind.DOOR, id);
    }

    public static DungeonTopologyRef wall(long id) {
        return new DungeonTopologyRef(DungeonTopologyElementKind.WALL, id);
    }

    public static DungeonTopologyRef corridorAnchor(long id) {
        return new DungeonTopologyRef(DungeonTopologyElementKind.CORRIDOR_ANCHOR, id);
    }

    public boolean present() {
        return kind != DungeonTopologyElementKind.EMPTY && id > 0L;
    }

    public boolean isDoor() {
        return kind == DungeonTopologyElementKind.DOOR;
    }

    public boolean isCorridorAnchor() {
        return kind == DungeonTopologyElementKind.CORRIDOR_ANCHOR;
    }
}
