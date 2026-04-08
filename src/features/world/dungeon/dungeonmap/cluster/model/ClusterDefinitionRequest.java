package features.world.dungeon.dungeonmap.cluster.model;

import features.world.dungeon.dungeonmap.structure.model.Structure;
import features.world.dungeon.model.structures.room.Room;

import java.util.List;

/**
 * Canonical cluster-owned construction and rehydration request.
 */
public record ClusterDefinitionRequest(
        Long clusterId,
        Long structureObjectId,
        long mapId,
        Structure structure,
        List<Room> rooms
) {
    public ClusterDefinitionRequest {
        structure = structure == null ? Structure.empty() : structure;
        rooms = rooms == null ? List.of() : List.copyOf(rooms);
    }
}
