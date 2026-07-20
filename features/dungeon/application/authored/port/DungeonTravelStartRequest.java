package features.dungeon.application.authored.port;

import features.dungeon.domain.core.structure.DungeonMapIdentity;
import java.util.Objects;

/** Revision-bound request for one deterministic sparse Travel entry. */
public record DungeonTravelStartRequest(
        DungeonMapIdentity mapId,
        long expectedMapRevision
) {
    public DungeonTravelStartRequest {
        mapId = Objects.requireNonNull(mapId, "mapId");
        if (expectedMapRevision < 1L) {
            throw new IllegalArgumentException("expectedMapRevision must be positive");
        }
    }
}
