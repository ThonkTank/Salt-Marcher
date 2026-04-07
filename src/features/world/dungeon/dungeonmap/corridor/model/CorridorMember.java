package features.world.dungeon.dungeonmap.corridor.model;

/**
 * A persisted authored corridor branch. The root member starts at the draft root door; child members start at a host
 * waypoint on another member.
 */
public record CorridorMember(
        Long memberId,
        CorridorTerminal terminal,
        Long hostMemberId,
        Long hostWaypointId
) {
    public CorridorMember {
        terminal = java.util.Objects.requireNonNull(terminal, "terminal");
        if ((hostMemberId == null) != (hostWaypointId == null)) {
            throw new IllegalArgumentException("Corridor member host refs must both be null or both be present");
        }
    }

    public boolean isRoot() {
        return hostMemberId == null;
    }
}
