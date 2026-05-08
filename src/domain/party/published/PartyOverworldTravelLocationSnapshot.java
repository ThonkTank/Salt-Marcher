package src.domain.party.published;

import src.domain.party.roster.value.PartyOverworldTravelLocation;

public final class PartyOverworldTravelLocationSnapshot implements PartyTravelLocationSnapshot {

    private final PartyOverworldTravelLocation location;

    public PartyOverworldTravelLocationSnapshot(
            long mapId,
            long tileId
    ) {
        this(new PartyOverworldTravelLocation(mapId, tileId));
    }

    public PartyOverworldTravelLocationSnapshot(PartyOverworldTravelLocation location) {
        this.location = location == null ? new PartyOverworldTravelLocation(0L, 0L) : location;
    }

    public static PartyOverworldTravelLocationSnapshot fromInternal(PartyOverworldTravelLocation location) {
        return new PartyOverworldTravelLocationSnapshot(location);
    }

    public PartyOverworldTravelLocation toInternal() {
        return location;
    }

    public long mapId() {
        return location.mapId();
    }

    public long tileId() {
        return location.tileId();
    }
}
