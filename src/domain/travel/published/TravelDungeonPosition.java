package src.domain.travel.published;

public record TravelDungeonPosition(
        long mapId,
        LocationKind locationKind,
        long ownerId,
        TravelDungeonCell tile,
        Heading heading
) {

    public TravelDungeonPosition {
        mapId = Math.max(1L, mapId);
        locationKind = locationKind == null ? LocationKind.TILE : locationKind;
        ownerId = Math.max(0L, ownerId);
        tile = tile == null ? new TravelDungeonCell(0, 0, 0) : tile;
        heading = heading == null ? Heading.SOUTH : heading;
    }

    public enum LocationKind {
        TILE,
        TRANSITION
    }

    public enum Heading {
        NORTH,
        EAST,
        SOUTH,
        WEST
    }
}
