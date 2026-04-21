package src.domain.party.published;

public record PartyOverworldTravelLocationSnapshot(
        long mapId,
        long tileId
) implements PartyTravelLocationSnapshot {

    public PartyOverworldTravelLocationSnapshot {
        mapId = Math.max(0L, mapId);
        tileId = Math.max(0L, tileId);
    }
}
