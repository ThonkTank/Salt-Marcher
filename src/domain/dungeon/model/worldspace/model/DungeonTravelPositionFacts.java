package src.domain.dungeon.model.worldspace.model;

import java.util.Locale;
import java.util.Objects;

public record DungeonTravelPositionFacts(
        DungeonMapIdentity mapId,
        LocationKind locationKind,
        long ownerId,
        DungeonCell tile,
        DungeonTravelHeading heading
) {

    public DungeonTravelPositionFacts {
        mapId = mapId == null ? new DungeonMapIdentity(1L) : mapId;
        locationKind = locationKind == null ? LocationKind.TILE : locationKind;
        ownerId = Math.max(0L, ownerId);
        tile = tile == null ? new DungeonCell(0, 0, 0) : tile;
        heading = heading == null ? DungeonTravelHeading.defaultHeading() : heading;
    }

    public static final class LocationKind {
        public static final LocationKind TILE = new LocationKind("TILE");
        public static final LocationKind STAIR_EXIT = new LocationKind("STAIR_EXIT");
        public static final LocationKind TRANSITION = new LocationKind("TRANSITION");

        private final String name;

        private LocationKind(String name) {
            this.name = name;
        }

        public String name() {
            return name;
        }

        public static LocationKind fromName(String name) {
            if (name == null || name.isBlank()) {
                return TILE;
            }
            return switch (name.trim().toUpperCase(Locale.ROOT)) {
                case "TRANSITION" -> TRANSITION;
                case "STAIR_EXIT" -> STAIR_EXIT;
                case "TILE" -> TILE;
                default -> throw new IllegalArgumentException("Unknown travel location kind.");
            };
        }

        @Override
        public boolean equals(Object other) {
            return this == other || other instanceof LocationKind locationKind && name.equals(locationKind.name);
        }

        @Override
        public int hashCode() {
            return Objects.hash(name);
        }

        @Override
        public String toString() {
            return name;
        }
    }
}
