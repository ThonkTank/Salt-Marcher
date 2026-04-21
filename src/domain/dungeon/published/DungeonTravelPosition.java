package src.domain.dungeon.published;

public record DungeonTravelPosition(
        DungeonMapId mapId,
        DungeonTravelLocationKind locationKind,
        long ownerId,
        DungeonCellRef tile,
        DungeonTravelHeading heading
) {

    public DungeonTravelPosition {
        mapId = mapId == null ? new DungeonMapId(1L) : mapId;
        locationKind = locationKind == null ? DungeonTravelLocationKind.TILE : locationKind;
        ownerId = Math.max(0L, ownerId);
        tile = tile == null ? new DungeonCellRef(0, 0, 0) : tile;
        heading = heading == null ? DungeonTravelHeading.defaultHeading() : heading;
    }
}
