package features.world.dungeon.dungeonmap.corridor.model;

import java.util.List;

/**
 * Canonical corridor-owned authored payload.
 */
public record CorridorSpecification(
        Long corridorId,
        Long structureObjectId,
        long mapId,
        int levelZ,
        List<CorridorNode> nodes,
        List<CorridorSegment> segments
) {
    public CorridorSpecification {
        nodes = nodes == null ? List.of() : List.copyOf(nodes);
        segments = segments == null ? List.of() : List.copyOf(segments);
    }
}
