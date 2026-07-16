package features.dungeon.domain.core.graph;

import java.util.Objects;

public final class DungeonTopologyRef {
    private final DungeonTopologyElementKind kind;
    private final long id;

    public DungeonTopologyRef(
            DungeonTopologyElementKind kind,
            long id
    ) {
        this.kind = kind == null ? DungeonTopologyElementKind.EMPTY : kind;
        this.id = Math.max(0L, id);
    }

    public DungeonTopologyElementKind kind() {
        return kind;
    }

    public long id() {
        return id;
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

    @Override
    public boolean equals(Object other) {
        return other instanceof DungeonTopologyRef that
                && id == that.id
                && Objects.equals(kind, that.kind);
    }

    @Override
    public int hashCode() {
        return Objects.hash(kind, id);
    }

    @Override
    public String toString() {
        return "DungeonTopologyRef[kind=" + kind + ", id=" + id + "]";
    }
}
