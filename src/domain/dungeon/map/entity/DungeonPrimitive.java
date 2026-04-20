package src.domain.dungeon.map.entity;

import src.domain.dungeon.map.value.DungeonEdge;

/**
 * Identity-bearing authored dungeon boundary primitive.
 */
public final class DungeonPrimitive {

    private final long id;
    private final String kind;
    private final String label;
    private final DungeonEdge edge;

    public DungeonPrimitive(long id, String kind, String label, DungeonEdge edge) {
        this.id = id;
        this.kind = kind == null || kind.isBlank() ? "primitive" : kind;
        this.label = label == null || label.isBlank() ? "Primitive" : label;
        this.edge = edge;
    }

    public long id() {
        return id;
    }

    public String kind() {
        return kind;
    }

    public String label() {
        return label;
    }

    public DungeonEdge edge() {
        return edge;
    }
}
