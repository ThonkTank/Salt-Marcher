package src.domain.dungeon.model.map.model;

public record DungeonTravelPositionFacts(
        DungeonMapIdentity mapId,
        DungeonTravelLocationKind locationKind,
        long ownerId,
        DungeonCell tile,
        DungeonTravelHeading heading
) {

    public DungeonTravelPositionFacts {
        mapId = mapId == null ? new DungeonMapIdentity(1L) : mapId;
        locationKind = locationKind == null ? DungeonTravelLocationKind.TILE : locationKind;
        ownerId = Math.max(0L, ownerId);
        tile = tile == null ? new DungeonCell(0, 0, 0) : tile;
        heading = heading == null ? DungeonTravelHeading.defaultHeading() : heading;
    }

    public DungeonTravelPositionFacts withMapAndTile(
            DungeonMapIdentity nextMapId,
            DungeonTravelLocationKind nextLocationKind,
            long nextOwnerId,
            DungeonCell nextTile
    ) {
        return new DungeonTravelPositionFacts(nextMapId, nextLocationKind, nextOwnerId, nextTile, heading);
    }
}
