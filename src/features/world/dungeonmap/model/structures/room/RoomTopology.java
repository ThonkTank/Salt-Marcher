package features.world.dungeonmap.model.structures.room;

import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.objects.StructureObject;

/**
 * Derived enclosed-space topology projected from the owning cluster structure.
 */
public record RoomTopology(StructureObject structure) {

    public RoomTopology {
        structure = structure == null ? StructureObject.empty() : structure;
    }

    public static RoomTopology empty() {
        return new RoomTopology(StructureObject.empty());
    }

    public static RoomTopology fromStructure(StructureObject structure) {
        return new RoomTopology(structure);
    }

    public RoomTopology movedBy(CellCoord delta, int levelDelta) {
        return new RoomTopology(structure.movedBy(delta, levelDelta));
    }
}
