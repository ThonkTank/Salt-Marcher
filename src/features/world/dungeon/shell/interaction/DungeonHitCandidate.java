package features.world.dungeon.shell.interaction;

import java.util.Objects;

public record DungeonHitCandidate(
        DungeonHitDescriptor descriptor,
        DungeonHitSurface matchedSurface,
        double distancePx,
        long basePriority,
        long effectivePriority
) {

    public DungeonHitCandidate {
        descriptor = Objects.requireNonNull(descriptor, "descriptor");
        matchedSurface = Objects.requireNonNull(matchedSurface, "matchedSurface");
        if (!Double.isFinite(distancePx) || distancePx < 0.0) {
            throw new IllegalArgumentException("distancePx must be finite and >= 0");
        }
    }
}
