package features.world.dungeon.dungeonmap.corridor.model;

import java.util.List;
import java.util.Objects;

/**
 * Canonical persisted corridor-authored input. The graph is derived transiently from this draft plus live map facts.
 */
public record CorridorDraft(
        Long corridorId,
        Long structureObjectId,
        long mapId,
        int levelZ,
        CorridorTerminal rootTerminal,
        List<CorridorMember> members,
        List<CorridorWaypoint> waypoints
) {
    public CorridorDraft {
        rootTerminal = Objects.requireNonNull(rootTerminal, "rootTerminal");
        members = members == null ? List.of() : List.copyOf(members);
        waypoints = waypoints == null ? List.of() : List.copyOf(waypoints);
    }
}
