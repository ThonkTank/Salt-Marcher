package src.domain.dungeon.map;

import src.domain.dungeon.published.DungeonEdgeRef;

/**
 * Primitive door boundary owner.
 */
public record DungeonDoorPrimitive(
        long id,
        String label,
        DungeonEdgeRef edge
) implements DungeonPrimitive {

    public DungeonDoorPrimitive {
        label = label == null || label.isBlank() ? "Door" : label;
    }
}
