package features.world.dungeon.dungeonmap.cluster.model;

import features.world.dungeon.geometry.GridPoint;
import features.world.dungeon.dungeonmap.structure.model.Structure;
import features.world.dungeon.model.structures.room.Room;

import java.util.List;

/**
 * Canonical cluster-owned authored payload.
 */
public record ClusterSpecification(
        Long clusterId,
        Long structureObjectId,
        long mapId,
        GridPoint center,
        Structure structure,
        List<Room> rooms
) {
    public ClusterSpecification {
        center = center == null ? GridPoint.cell(0, 0, 0) : center;
        structure = structure == null ? Structure.empty() : structure;
        rooms = rooms == null ? List.of() : List.copyOf(rooms);
    }
}
