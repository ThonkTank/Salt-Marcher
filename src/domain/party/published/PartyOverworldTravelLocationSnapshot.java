package src.domain.party.published;

public record PartyOverworldTravelLocationSnapshot(
        long mapId,
        long tileId
) implements PartyTravelLocationSnapshot {

    @Override
    public boolean isOverworld() {
        return true;
    }

    @Override
    public long overworldTileId() {
        return tileId;
    }
}
