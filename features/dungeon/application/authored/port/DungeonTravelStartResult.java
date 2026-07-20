package features.dungeon.application.authored.port;

import features.dungeon.domain.core.geometry.Cell;
import java.util.Objects;
import org.jspecify.annotations.Nullable;

/** One indexed Travel entry location, an empty map, or a typed revision failure. */
public sealed interface DungeonTravelStartResult permits DungeonTravelStartResult.Located,
        DungeonTravelStartResult.Empty, DungeonTravelStartResult.Rejected {

    record Located(
            DungeonMapHeader mapHeader,
            Cell windowAnchor,
            @Nullable Long transitionId
    ) implements DungeonTravelStartResult {
        public Located {
            mapHeader = Objects.requireNonNull(mapHeader, "mapHeader");
            windowAnchor = Objects.requireNonNull(windowAnchor, "windowAnchor");
            transitionId = transitionId == null || transitionId <= 0L ? null : transitionId;
        }
    }

    record Empty(DungeonMapHeader mapHeader) implements DungeonTravelStartResult {
        public Empty {
            mapHeader = Objects.requireNonNull(mapHeader, "mapHeader");
        }
    }

    record Rejected(DungeonIdentityClosureResult.Reason reason) implements DungeonTravelStartResult {
        public Rejected {
            reason = Objects.requireNonNull(reason, "reason");
        }
    }
}
