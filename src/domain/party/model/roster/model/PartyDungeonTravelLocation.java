package src.domain.party.model.roster.model;

import java.util.Objects;
import src.domain.party.published.PartyDungeonTravelLocationKind;
import src.domain.party.published.PartyTravelHeading;
import src.domain.party.published.PartyTravelTile;

public final class PartyDungeonTravelLocation extends PartyTravelLocation {

    private final long mapId;
    private final PartyDungeonTravelLocationKind locationKind;
    private final long ownerId;
    private final PartyTravelTile tile;
    private final PartyTravelHeading heading;

    public PartyDungeonTravelLocation(
            long mapId,
            PartyDungeonTravelLocationKind locationKind,
            long ownerId,
            PartyTravelTile tile,
            PartyTravelHeading heading
    ) {
        this.mapId = Math.max(1L, mapId);
        this.locationKind = locationKind == null ? PartyDungeonTravelLocationKind.TILE : locationKind;
        this.ownerId = Math.max(0L, ownerId);
        this.tile = tile == null ? new PartyTravelTile(0, 0, 0) : tile;
        this.heading = heading == null ? PartyTravelHeading.defaultHeading() : heading;
    }

    public long mapId() {
        return mapId;
    }

    public PartyDungeonTravelLocationKind locationKind() {
        return locationKind;
    }

    public long ownerId() {
        return ownerId;
    }

    public PartyTravelTile tile() {
        return tile;
    }

    public PartyTravelHeading heading() {
        return heading;
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof PartyDungeonTravelLocation that)) {
            return false;
        }
        return mapId == that.mapId
                && ownerId == that.ownerId
                && locationKind == that.locationKind
                && Objects.equals(tile, that.tile)
                && heading == that.heading;
    }

    @Override
    public int hashCode() {
        return Objects.hash(mapId, locationKind, ownerId, tile, heading);
    }

    @Override
    public String toString() {
        return "PartyDungeonTravelLocation[mapId=" + mapId
                + ", locationKind=" + locationKind
                + ", ownerId=" + ownerId
                + ", tile=" + tile
                + ", heading=" + heading
                + ']';
    }
}
