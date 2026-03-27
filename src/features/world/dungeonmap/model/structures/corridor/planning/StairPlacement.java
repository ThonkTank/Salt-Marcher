package features.world.dungeonmap.model.structures.corridor.planning;

import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.structures.stair.DungeonStair;
import features.world.dungeonmap.model.structures.stair.DungeonStairExit;
import features.world.dungeonmap.model.structures.stair.StairPathGenerator;
import features.world.dungeonmap.model.structures.stair.StairShape;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

// Eine Treppe, die der Pathfinder platziert hat. Public, da von DungeonCorridorEditService gelesen.
public record StairPlacement(
        Point2i anchor,
        StairShape shape,
        CardinalDirection direction,
        int dimension1,
        int dimension2,
        List<Integer> exitLevels,
        Set<CubePoint> footprint
) {
    public StairPlacement {
        exitLevels = exitLevels == null ? List.of() : List.copyOf(exitLevels);
        footprint = footprint == null ? Set.of() : Set.copyOf(footprint);
    }

    public DungeonStair toPreviewStair(long mapId, Long corridorId) {
        if (exitLevels.size() < 2) {
            return null;
        }
        int minZ = exitLevels.getFirst();
        int maxZ = exitLevels.getLast();
        List<CubePoint> pathNodes;
        try {
            pathNodes = StairPathGenerator.generatePath(shape, anchor, direction, minZ, maxZ, dimension1, dimension2);
        } catch (IllegalArgumentException ignored) {
            return null;
        }
        List<DungeonStairExit> exits = new ArrayList<>();
        java.util.Map<Integer, CubePoint> pathByZ = new java.util.LinkedHashMap<>();
        for (CubePoint node : pathNodes) {
            pathByZ.put(node.z(), node);
        }
        for (int level : exitLevels) {
            CubePoint exitPoint = pathByZ.get(level);
            if (exitPoint != null) {
                exits.add(new DungeonStairExit(0L, exitPoint, "Ebene z=" + level));
            }
        }
        return new DungeonStair(null, mapId, null, shape, direction, dimension1, dimension2, pathNodes, exits, corridorId);
    }
}
