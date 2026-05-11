package src.domain.party.model.roster.model;

import java.util.Objects;

public final class PartyOverworldTravelLocation extends PartyTravelLocation {

    private final long mapId;
    private final long tileId;

    public PartyOverworldTravelLocation(long mapId, long tileId) {
        this.mapId = Math.max(0L, mapId);
        this.tileId = Math.max(0L, tileId);
    }

    public long mapId() {
        return mapId;
    }

    public long tileId() {
        return tileId;
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof PartyOverworldTravelLocation that)) {
            return false;
        }
        return mapId == that.mapId && tileId == that.tileId;
    }

    @Override
    public int hashCode() {
        return Objects.hash(mapId, tileId);
    }

    @Override
    public String toString() {
        return "PartyOverworldTravelLocation[mapId=" + mapId
                + ", tileId=" + tileId
                + ']';
    }
}
