package features.world.dungeonmap.application.runtime;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.corridor.CorridorNetwork;
import features.world.dungeonmap.model.structures.room.Room;

public final class DungeonRuntimeLocationTileResolver {

    private DungeonRuntimeLocationTileResolver() {
        throw new AssertionError("No instances");
    }

    public static CubePoint resolve(DungeonLayout layout, DungeonRuntimeLocation location) {
        if (layout == null || location == null) {
            return null;
        }
        if (location instanceof DungeonRuntimeLocation.Tile tile) {
            return tile.tile();
        }
        if (location instanceof DungeonRuntimeLocation.StairExit stairExit) {
            return stairExit.tile();
        }
        if (location instanceof DungeonRuntimeLocation.Room roomLocation) {
            Room room = layout.findRoom(roomLocation.roomId());
            return room == null || room.floor() == null
                    ? null
                    : CubePoint.at(room.floor().shape().centerCell(), layout.levelForRoom(room.roomId()));
        }
        if (location instanceof DungeonRuntimeLocation.Corridor corridorLocation) {
            Corridor corridor = layout.findCorridor(corridorLocation.corridorId());
            return corridor == null || corridor.path() == null || corridor.path().floor() == null
                    ? null
                    : CubePoint.at(corridor.path().floor().shape().centerCell(), layout.levelForCorridor(corridor.corridorId()));
        }
        if (location instanceof DungeonRuntimeLocation.CorridorComponent componentLocation) {
            CorridorNetwork network = layout.findCorridorNetwork(componentLocation.componentId());
            if (network == null || network.floor() == null) {
                return null;
            }
            Long corridorId = network.corridorIds().stream()
                    .filter(id -> id != null)
                    .findFirst()
                    .orElse(null);
            return CubePoint.at(network.floor().shape().centerCell(), layout.levelForCorridor(corridorId));
        }
        return null;
    }
}
