package src.domain.party.published;

public record PartyOverworldTravelLocationSnapshot(
        long mapId,
        long tileId
) implements PartyTravelLocationSnapshot {
}
