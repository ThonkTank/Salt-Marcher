package features.world.dungeonmap.application.runtime;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.objects.Floor;
import features.world.dungeonmap.model.structures.corridor.Corridor;

import java.util.Set;

final class DungeonRuntimeCorridorGeometry {

    private DungeonRuntimeCorridorGeometry() {
        throw new AssertionError("No instances");
    }

    static Set<Point2i> canonicalCells(DungeonLayout layout, Corridor corridor) {
        Floor floor = canonicalFloor(layout, corridor);
        return floor == null || floor.shape() == null ? Set.of() : floor.shape().absoluteCells();
    }

    static CubePoint canonicalAnchor(DungeonLayout layout, Corridor corridor) {
        Integer levelZ = canonicalLevel(layout, corridor);
        Floor floor = canonicalFloor(layout, corridor);
        if (levelZ == null || floor == null || floor.shape() == null || floor.shape().size() == 0) {
            return null;
        }
        return CubePoint.at(floor.shape().centerCell(), levelZ);
    }

    private static Floor canonicalFloor(DungeonLayout layout, Corridor corridor) {
        Integer levelZ = canonicalLevel(layout, corridor);
        if (levelZ == null || corridor.path() == null) {
            return null;
        }
        return corridor.path().floorAtLevel(levelZ);
    }

    private static Integer canonicalLevel(DungeonLayout layout, Corridor corridor) {
        if (layout == null || corridor == null || corridor.corridorId() == null || corridor.path() == null) {
            return null;
        }
        return layout.levelForCorridor(corridor.corridorId());
    }
}
