package src.domain.dungeon.model.worldspace.model;

/**
 * Identity-bearing authored dungeon boundary primitive.
 */
public record DungeonPrimitive(long id, String kind, String label, DungeonEdge edge) {

    public DungeonPrimitive {
        kind = kind == null || kind.isBlank() ? "primitive" : kind;
        label = label == null || label.isBlank() ? "Primitive" : label;
    }
}
