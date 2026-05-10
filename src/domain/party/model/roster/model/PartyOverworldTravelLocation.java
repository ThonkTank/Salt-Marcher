package src.domain.party.model.roster.model;

public record PartyOverworldTravelLocation(
        long mapId,
        long tileId
) implements PartyTravelLocation {

    public PartyOverworldTravelLocation {
        mapId = Math.max(0L, mapId);
        tileId = Math.max(0L, tileId);
    }
}
