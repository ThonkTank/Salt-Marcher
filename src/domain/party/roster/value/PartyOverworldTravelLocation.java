package src.domain.party.roster.value;

public record PartyOverworldTravelLocation(
        long mapId,
        long tileId
) implements PartyTravelLocation {

    public PartyOverworldTravelLocation {
        mapId = Math.max(0L, mapId);
        tileId = Math.max(0L, tileId);
    }
}
