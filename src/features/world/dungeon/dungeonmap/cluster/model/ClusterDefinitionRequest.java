package features.world.dungeon.dungeonmap.cluster.model;

import features.world.dungeon.dungeonmap.structure.StructureObject;
import features.world.dungeon.dungeonmap.structure.input.EmptyInput;
import features.world.dungeon.dungeonmap.structure.model.Structure;
import features.world.dungeon.model.structures.room.Room;

import java.util.List;

/**
 * Canonical cluster-owned construction and rehydration request.
 */
@SuppressWarnings("unused")
public record ClusterDefinitionRequest(
        Long clusterId,
        Long structureObjectId,
        long mapId,
        Structure structure,
        List<Room> rooms
) {
    private static final StructureObject STRUCTURE = new StructureObject();

    public ClusterDefinitionRequest {
        structure = structure == null ? STRUCTURE.empty(new EmptyInput()) : structure;
        rooms = rooms == null ? List.of() : List.copyOf(rooms);
    }
}
