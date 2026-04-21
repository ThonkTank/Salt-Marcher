package src.domain.party.published;

public record PartyDungeonTravelLocationSnapshot(
        long mapId,
        PartyDungeonTravelLocationKind locationKind,
        long ownerId,
        PartyTravelTile tile,
        PartyTravelHeading heading
) implements PartyTravelLocationSnapshot {

    public PartyDungeonTravelLocationSnapshot {
        mapId = Math.max(1L, mapId);
        locationKind = locationKind == null ? PartyDungeonTravelLocationKind.TILE : locationKind;
        ownerId = Math.max(0L, ownerId);
        tile = tile == null ? new PartyTravelTile(0, 0, 0) : tile;
        heading = heading == null ? PartyTravelHeading.defaultHeading() : heading;
    }
}
