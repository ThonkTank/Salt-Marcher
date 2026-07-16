package features.party.api;

public record PartyDungeonTravelLocationSnapshot(
        long mapId,
        PartyDungeonTravelLocationKind locationKind,
        long ownerId,
        PartyTravelTile tile,
        PartyTravelHeading heading
) implements PartyTravelLocationSnapshot {

    public PartyDungeonTravelLocationSnapshot {
        locationKind = locationKind == null ? PartyDungeonTravelLocationKind.TILE : locationKind;
        tile = tile == null ? new PartyTravelTile(0, 0, 0) : tile;
        heading = heading == null ? PartyTravelHeading.defaultHeading() : heading;
    }

    @Override
    public boolean isDungeon() {
        return true;
    }

    @Override
    public String dungeonLocationKindName() {
        return locationKind.name();
    }

    @Override
    public long dungeonOwnerId() {
        return ownerId;
    }

    @Override
    public int dungeonTileQ() {
        return tile.q();
    }

    @Override
    public int dungeonTileR() {
        return tile.r();
    }

    @Override
    public int dungeonTileLevel() {
        return tile.level();
    }

    @Override
    public String dungeonHeadingName() {
        return heading.name();
    }
}
