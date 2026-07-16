package features.dungeon.application.travel.projection;

import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.application.travel.session.TravelDungeonSessionSurface.LocationKind;

public record TravelPositionFacts(
        long mapId,
        LocationKind locationKind,
        long ownerId,
        Cell tile,
        TravelHeading heading
) {

    public TravelPositionFacts {
        mapId = Math.max(1L, mapId);
        locationKind = locationKind == null ? LocationKind.TILE : locationKind;
        ownerId = Math.max(0L, ownerId);
        tile = tile == null ? new Cell(0, 0, 0) : tile;
        heading = heading == null ? TravelHeading.defaultHeading() : heading;
    }

}
