package features.world.dungeonmap.model.structures.corridor.planning;

import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.structures.stair.StairPathGenerator;
import features.world.dungeonmap.model.structures.stair.StairShape;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

final class StairExpansion {

    private static final int STRAIGHT_COST_PER_LEVEL = 2;
    private static final int SQUARE_COST_PER_LEVEL = 3;
    private static final int LADDER_COST_PER_LEVEL = 4;

    private StairExpansion() {
    }

    static List<StairNeighbor> expand(CubePoint cell, SearchVolume volume, Set<CubePoint> treeCells) {
        if (cell == null || volume == null) {
            return List.of();
        }
        List<StairNeighbor> results = new ArrayList<>();
        for (CardinalDirection direction : CardinalDirection.values()) {
            expandDirected(cell, direction, true, volume, treeCells, results);
            expandDirected(cell, direction, false, volume, treeCells, results);
        }
        expandLadder(cell, true, volume, treeCells, results);
        expandLadder(cell, false, volume, treeCells, results);
        return List.copyOf(results);
    }

    private static void expandDirected(
            CubePoint cell,
            CardinalDirection direction,
            boolean ascending,
            SearchVolume volume,
            Set<CubePoint> treeCells,
            List<StairNeighbor> results
    ) {
        int maxDelta = ascending
                ? volume.maxZ() - cell.z()
                : cell.z() - volume.minZ();
        if (maxDelta < 1) {
            return;
        }
        for (StairShape shape : List.of(StairShape.STRAIGHT, StairShape.SQUARE)) {
            for (int delta = 1; delta <= maxDelta; delta++) {
                int minZ = ascending ? cell.z() : cell.z() - delta;
                int maxZ = ascending ? cell.z() + delta : cell.z();
                int height = maxZ - minZ + 1;

                int dimension1 = 0;
                int dimension2 = 0;
                if (shape == StairShape.SQUARE) {
                    if (height < 4) {
                        break;
                    }
                    dimension1 = (int) Math.ceil(Math.sqrt(height));
                }

                List<CubePoint> path;
                try {
                    path = StairPathGenerator.generatePath(
                            shape,
                            cell.projectedCell(),
                            direction,
                            minZ,
                            maxZ,
                            dimension1,
                            dimension2);
                } catch (IllegalArgumentException ignored) {
                    break;
                }
                if (path.isEmpty()) {
                    break;
                }
                if (!volume.isFootprintPassable(path) || collidesWithTree(path, treeCells, cell)) {
                    break;
                }
                CubePoint exitCell = ascending ? path.getLast() : path.getFirst();
                int costPerLevel = shape == StairShape.STRAIGHT
                        ? STRAIGHT_COST_PER_LEVEL
                        : SQUARE_COST_PER_LEVEL;
                results.add(new StairNeighbor(
                        exitCell,
                        path,
                        shape,
                        direction,
                        dimension1,
                        dimension2,
                        minZ,
                        maxZ,
                        height * costPerLevel));
                break;
            }
        }
    }

    private static void expandLadder(
            CubePoint cell,
            boolean ascending,
            SearchVolume volume,
            Set<CubePoint> treeCells,
            List<StairNeighbor> results
    ) {
        int targetZ = ascending ? cell.z() + 1 : cell.z() - 1;
        CubePoint target = CubePoint.at(cell.projectedCell(), targetZ);
        if (!volume.isPassable(target) || (treeCells != null && treeCells.contains(target))) {
            return;
        }
        int minZ = Math.min(cell.z(), targetZ);
        int maxZ = Math.max(cell.z(), targetZ);
        List<CubePoint> path = List.of(
                CubePoint.at(cell.projectedCell(), minZ),
                CubePoint.at(cell.projectedCell(), maxZ));
        results.add(new StairNeighbor(
                target,
                path,
                StairShape.LADDER,
                CardinalDirection.defaultDirection(),
                0,
                0,
                minZ,
                maxZ,
                LADDER_COST_PER_LEVEL * 2));
    }

    private static boolean collidesWithTree(List<CubePoint> path, Set<CubePoint> treeCells, CubePoint origin) {
        if (treeCells == null || treeCells.isEmpty()) {
            return false;
        }
        for (CubePoint cell : path) {
            if (!cell.equals(origin) && treeCells.contains(cell)) {
                return true;
            }
        }
        return false;
    }
}
