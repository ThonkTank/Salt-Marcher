package features.world.dungeon.dungeonmap.structure.input;

import java.util.List;

/**
 * Canonical request for deriving room topology over an existing physical structure.
 */
@SuppressWarnings("unused")
public record WithRoomMetadataInput(
        features.world.dungeon.dungeonmap.structure.model.Structure structure,
        long mapId,
        Long clusterId,
        List<features.world.dungeon.model.structures.room.Room> rooms
) {
}
