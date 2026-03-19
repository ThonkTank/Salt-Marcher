package features.world.dungeonmap.model.structures.room;

import features.world.dungeonmap.model.objects.TileShape;

public record Room(
        Long roomId,
        long mapId,
        long clusterId,
        String name,
        TileShape geometry
) {
    public Room {
        geometry = (geometry == null ? TileShape.singleCell(null) : geometry).recentered();
    }

    public Room withGeometry(TileShape geometry) {
        return new Room(roomId, mapId, clusterId, name, geometry);
    }

    public int distanceTo(Room other) {
        return other == null ? Integer.MAX_VALUE : geometry.anchor().distanceTo(other.geometry.anchor());
    }
}
