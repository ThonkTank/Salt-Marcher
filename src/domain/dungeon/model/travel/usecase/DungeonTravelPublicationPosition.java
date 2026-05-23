package src.domain.dungeon.model.travel.usecase;

import src.domain.dungeon.model.map.model.DungeonCell;
import src.domain.dungeon.model.map.model.DungeonMapIdentity;
import src.domain.dungeon.model.map.model.DungeonTravelHeading;
import src.domain.dungeon.model.map.model.DungeonTravelPositionFacts;

final class DungeonTravelPublicationPosition {
    private final long mapId;
    private final DungeonTravelPositionFacts.LocationKind locationKind;
    private final long ownerId;
    private final int q;
    private final int r;
    private final int level;
    private final DungeonTravelHeading heading;

    private DungeonTravelPublicationPosition(
            long mapId,
            DungeonTravelPositionFacts.LocationKind locationKind,
            long ownerId,
            int q,
            int r,
            int level,
            DungeonTravelHeading heading
    ) {
        this.mapId = mapId;
        this.locationKind = locationKind;
        this.ownerId = Math.max(0L, ownerId);
        this.q = q;
        this.r = r;
        this.level = level;
        this.heading = heading;
    }

    static DungeonTravelPublicationPosition fromNames(
            long mapId,
            String locationKind,
            long ownerId,
            int q,
            int r,
            int level,
            String heading
    ) {
        return new DungeonTravelPublicationPosition(
                mapId,
                locationKind(locationKind),
                ownerId,
                q,
                r,
                level,
                heading(heading));
    }

    DungeonTravelPositionFacts toFacts() {
        return new DungeonTravelPositionFacts(
                new DungeonMapIdentity(mapId),
                locationKind,
                ownerId,
                new DungeonCell(q, r, level),
                heading);
    }

    private static DungeonTravelPositionFacts.LocationKind locationKind(String name) {
        return DungeonTravelPositionFacts.LocationKind.fromName(name);
    }

    private static DungeonTravelHeading heading(String name) {
        if (name == null || name.isBlank()) {
            return DungeonTravelHeading.SOUTH;
        }
        return switch (name.trim()) {
            case "NORTH" -> DungeonTravelHeading.NORTH;
            case "EAST" -> DungeonTravelHeading.EAST;
            case "WEST" -> DungeonTravelHeading.WEST;
            case "SOUTH" -> DungeonTravelHeading.SOUTH;
            default -> throw new IllegalArgumentException("Unknown travel heading.");
        };
    }
}
