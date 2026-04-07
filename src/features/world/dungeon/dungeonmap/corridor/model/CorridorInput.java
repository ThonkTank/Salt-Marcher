package features.world.dungeon.dungeonmap.corridor.model;

import java.util.List;

/**
 * Canonical persisted corridor input. Routing and final structure are derived from this authored network.
 */
public record CorridorInput(
        Long corridorId,
        Long structureObjectId,
        long mapId,
        int levelZ,
        List<CorridorInputNode> nodes,
        List<CorridorSegment> segments
) {
    public CorridorInput {
        nodes = nodes == null ? List.of() : List.copyOf(nodes);
        segments = segments == null ? List.of() : List.copyOf(segments);
    }
}
