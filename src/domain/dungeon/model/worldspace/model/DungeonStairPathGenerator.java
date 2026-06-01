package src.domain.dungeon.model.worldspace.model;

import java.util.ArrayList;
import java.util.List;

final class DungeonStairPathGenerator {
    private DungeonStairPathGenerator() {
    }

    static List<DungeonCell> path(
            DungeonStairShape shape,
            DungeonCell anchor,
            DungeonEdgeDirection direction,
            int dimension1
    ) {
        return switch (shape) {
            case STRAIGHT -> straightPath(anchor, direction, dimension1);
            case SQUARE -> squareSpiralPath(anchor, direction, dimension1);
            case CIRCULAR -> circularSpiralPath(anchor, direction, dimension1);
            default -> List.of();
        };
    }

    private static List<DungeonCell> straightPath(
            DungeonCell anchor,
            DungeonEdgeDirection direction,
            int dimension1
    ) {
        List<DungeonCell> path = new ArrayList<>();
        for (int step = 0; step < dimension1; step++) {
            path.add(localCell(anchor, direction, step, 0));
        }
        return List.copyOf(path);
    }

    private static List<DungeonCell> squareSpiralPath(
            DungeonCell anchor,
            DungeonEdgeDirection direction,
            int sideLength
    ) {
        List<DungeonCell> path = new ArrayList<>();
        for (int min = 0, max = sideLength - 1; min <= max; min++, max--) {
            appendSquareRing(path, anchor, direction, min, max);
        }
        return List.copyOf(path);
    }

    private static void appendSquareRing(
            List<DungeonCell> path,
            DungeonCell anchor,
            DungeonEdgeDirection direction,
            int min,
            int max
    ) {
        for (int x = min; x <= max; x++) {
            path.add(localCell(anchor, direction, x, min));
        }
        for (int y = min + 1; y <= max; y++) {
            path.add(localCell(anchor, direction, max, y));
        }
        for (int x = max - 1; x >= min && min < max; x--) {
            path.add(localCell(anchor, direction, x, max));
        }
        for (int y = max - 1; y > min && min < max; y--) {
            path.add(localCell(anchor, direction, min, y));
        }
    }

    private static List<DungeonCell> circularSpiralPath(
            DungeonCell anchor,
            DungeonEdgeDirection direction,
            int diameter
    ) {
        int radius = diameter / 2;
        List<CircularCell> candidates = new ArrayList<>();
        int threshold = radius * (radius + 1);
        for (int x = -radius; x <= radius; x++) {
            for (int y = 0; y <= radius * 2; y++) {
                int centeredY = y - radius;
                if (x * x + centeredY * centeredY <= threshold) {
                    candidates.add(new CircularCell(x, y, centeredY));
                }
            }
        }
        candidates.sort(DungeonStairPathGenerator::compareCircularCells);
        List<DungeonCell> path = new ArrayList<>();
        for (CircularCell cell : candidates) {
            path.add(localCell(anchor, direction, cell.x(), cell.y()));
        }
        return List.copyOf(path);
    }

    private static int compareCircularCells(CircularCell left, CircularCell right) {
        int ringComparison = Integer.compare(right.ring(), left.ring());
        if (ringComparison != 0) {
            return ringComparison;
        }
        return Double.compare(left.angleFromAnchor(), right.angleFromAnchor());
    }

    private static DungeonCell localCell(
            DungeonCell anchor,
            DungeonEdgeDirection direction,
            int forward,
            int right
    ) {
        DungeonEdgeDirection rightDirection = rightTurn(direction);
        return new DungeonCell(
                anchor.q() + direction.deltaQ() * forward + rightDirection.deltaQ() * right,
                anchor.r() + direction.deltaR() * forward + rightDirection.deltaR() * right,
                anchor.level());
    }

    private static DungeonEdgeDirection rightTurn(DungeonEdgeDirection direction) {
        if (direction == DungeonEdgeDirection.EAST) {
            return DungeonEdgeDirection.SOUTH;
        }
        if (direction == DungeonEdgeDirection.SOUTH) {
            return DungeonEdgeDirection.WEST;
        }
        if (direction == DungeonEdgeDirection.WEST) {
            return DungeonEdgeDirection.NORTH;
        }
        return DungeonEdgeDirection.EAST;
    }

    private record CircularCell(int x, int y, int centeredY) {
        int ring() {
            return Math.max(Math.abs(x), Math.abs(centeredY));
        }

        double angleFromAnchor() {
            double angle = Math.atan2(x, -centeredY);
            return angle < 0.0 ? angle + Math.PI * 2.0 : angle;
        }
    }
}
