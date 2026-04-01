package features.world.dungeonmap.application.runtime;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.model.structures.transition.DungeonTransition;

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
        if (location instanceof DungeonRuntimeLocation.Transition transitionLocation) {
            DungeonTransition transition = layout.findTransition(transitionLocation.transitionId());
            return transition == null ? null : transition.anchor();
        }
        if (location instanceof DungeonRuntimeLocation.Room roomLocation) {
            Room room = layout.findRoom(roomLocation.roomId());
            return room == null
                    ? null
                    : room.geometry().centerPointAtLevel(layout.levelForRoom(room.roomId()));
        }
        if (location instanceof DungeonRuntimeLocation.Corridor corridorLocation) {
            Corridor corridor = layout.findCorridor(corridorLocation.corridorId());
            if (corridor != null) {
                return corridor.geometry().centerPointAtLevel(corridor.levelZ());
            }
            return corridorLocation.anchorTile();
        }
        return null;
    }
}
