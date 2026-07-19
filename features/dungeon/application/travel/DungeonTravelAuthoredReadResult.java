package features.dungeon.application.travel;

import features.dungeon.application.travel.projection.TravelAuthoredSurface;
import java.util.Objects;

/** Typed sparse authored read outcome for Dungeon Travel. */
public sealed interface DungeonTravelAuthoredReadResult permits DungeonTravelAuthoredReadResult.Loaded,
        DungeonTravelAuthoredReadResult.Unavailable {

    record Loaded(TravelAuthoredSurface surface) implements DungeonTravelAuthoredReadResult {
        public Loaded {
            surface = Objects.requireNonNull(surface, "surface");
        }
    }

    record Unavailable(Reason reason) implements DungeonTravelAuthoredReadResult {
        public Unavailable {
            reason = Objects.requireNonNull(reason, "reason");
        }
    }

    enum Reason {
        MAP_MISSING,
        STALE_REVISION,
        ENTITY_MISSING,
        MALFORMED_ENTITY,
        INCOMPLETE_ENTITY,
        TARGET_UNAVAILABLE
    }
}
