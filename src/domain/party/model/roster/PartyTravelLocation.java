package src.domain.party.model.roster;

public final class PartyTravelLocation {

    public enum TravelSpace {
        DUNGEON,
        OVERWORLD
    }

    private final TravelSpace space;
    private final long mapId;
    private final long overworldTileId;
    private final PartyDungeonTravelLocationKind dungeonLocationKind;
    private final long dungeonOwnerId;
    private final PartyTravelTile dungeonTile;
    private final PartyTravelHeading dungeonHeading;

    private PartyTravelLocation(
            TravelSpace space,
            long mapId,
            long overworldTileId,
            PartyDungeonTravelLocationKind dungeonLocationKind,
            long dungeonOwnerId,
            PartyTravelTile dungeonTile,
            PartyTravelHeading dungeonHeading
    ) {
        this.space = space == null ? TravelSpace.OVERWORLD : space;
        this.mapId = Math.max(0L, mapId);
        this.overworldTileId = Math.max(0L, overworldTileId);
        this.dungeonLocationKind = dungeonLocationKind == null ? PartyDungeonTravelLocationKind.TILE : dungeonLocationKind;
        this.dungeonOwnerId = Math.max(0L, dungeonOwnerId);
        this.dungeonTile = dungeonTile == null ? new PartyTravelTile(0, 0, 0) : dungeonTile;
        this.dungeonHeading = dungeonHeading == null ? PartyTravelHeading.defaultHeading() : dungeonHeading;
    }

    public static PartyTravelLocation dungeon(
            long mapId,
            PartyDungeonTravelLocationKind locationKind,
            long ownerId,
            PartyTravelTile tile,
            PartyTravelHeading heading
    ) {
        return new PartyTravelLocation(TravelSpace.DUNGEON, mapId, 0L, locationKind, ownerId, tile, heading);
    }

    public static PartyTravelLocation overworld(long mapId, long tileId) {
        return new PartyTravelLocation(
                TravelSpace.OVERWORLD,
                mapId,
                tileId,
                PartyDungeonTravelLocationKind.TILE,
                0L,
                new PartyTravelTile(0, 0, 0),
                PartyTravelHeading.defaultHeading());
    }

    public boolean isDungeon() {
        return space == TravelSpace.DUNGEON;
    }

    public boolean isOverworld() {
        return space == TravelSpace.OVERWORLD;
    }

    public long mapId() {
        return mapId;
    }

    public long overworldTileId() {
        return overworldTileId;
    }

    public PartyDungeonTravelLocationKind dungeonLocationKind() {
        return dungeonLocationKind;
    }

    public long dungeonOwnerId() {
        return dungeonOwnerId;
    }

    public PartyTravelTile dungeonTile() {
        return dungeonTile;
    }

    public PartyTravelHeading dungeonHeading() {
        return dungeonHeading;
    }
}
