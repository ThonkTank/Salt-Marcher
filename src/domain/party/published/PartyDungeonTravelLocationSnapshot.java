package src.domain.party.published;

import src.domain.party.roster.value.PartyDungeonTravelLocation;

public final class PartyDungeonTravelLocationSnapshot implements PartyTravelLocationSnapshot {

    private final PartyDungeonTravelLocation location;

    public PartyDungeonTravelLocationSnapshot(
            long mapId,
            PartyDungeonTravelLocationKind locationKind,
            long ownerId,
            PartyTravelTile tile,
            PartyTravelHeading heading
    ) {
        this(new PartyDungeonTravelLocation(
                mapId,
                locationKind == null ? src.domain.party.roster.value.PartyDungeonTravelLocationKind.TILE : locationKind.toInternal(),
                ownerId,
                tile == null ? new src.domain.party.roster.value.PartyTravelTile(0, 0, 0) : tile.toInternal(),
                heading == null ? src.domain.party.roster.value.PartyTravelHeading.defaultHeading() : heading.toInternal()));
    }

    public PartyDungeonTravelLocationSnapshot(PartyDungeonTravelLocation location) {
        this.location = location == null
                ? new PartyDungeonTravelLocation(
                        1L,
                        src.domain.party.roster.value.PartyDungeonTravelLocationKind.TILE,
                        0L,
                        new src.domain.party.roster.value.PartyTravelTile(0, 0, 0),
                        src.domain.party.roster.value.PartyTravelHeading.defaultHeading())
                : location;
    }

    public static PartyDungeonTravelLocationSnapshot fromInternal(PartyDungeonTravelLocation location) {
        return new PartyDungeonTravelLocationSnapshot(location);
    }

    public PartyDungeonTravelLocation toInternal() {
        return location;
    }

    public long mapId() {
        return location.mapId();
    }

    public PartyDungeonTravelLocationKind locationKind() {
        return PartyDungeonTravelLocationKind.fromInternal(location.locationKind());
    }

    public long ownerId() {
        return location.ownerId();
    }

    public PartyTravelTile tile() {
        return PartyTravelTile.fromInternal(location.tile());
    }

    public PartyTravelHeading heading() {
        return PartyTravelHeading.fromInternal(location.heading());
    }
}
