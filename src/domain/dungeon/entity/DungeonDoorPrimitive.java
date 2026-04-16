package src.domain.dungeon.entity;

import src.domain.mapcore.api.MapEdgeRef;

/**
 * Primitive door boundary owner.
 */
public record DungeonDoorPrimitive(
        long id,
        String label,
        MapEdgeRef edge
) implements DungeonPrimitive {

    public DungeonDoorPrimitive {
        label = label == null || label.isBlank() ? "Door" : label;
    }
}
