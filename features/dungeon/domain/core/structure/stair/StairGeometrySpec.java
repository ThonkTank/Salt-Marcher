package features.dungeon.domain.core.structure.stair;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import features.dungeon.domain.core.component.StairExit;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Direction;

public record StairGeometrySpec(
        StairShape shape,
        Cell anchor,
        Direction direction,
        int dimension1,
        int dimension2
) {
    public StairGeometrySpec {
        shape = shape == null ? StairShape.defaultShape() : shape;
        anchor = Objects.requireNonNull(anchor);
        direction = direction == null ? Direction.NORTH : direction;
        dimension1 = shape.normalizedEditorDimension1(Math.max(0, dimension1));
        dimension2 = Math.max(0, dimension2);
    }

    public List<Cell> generatedPath() {
        return switch (shape) {
            case STRAIGHT -> straightPath(anchor, direction, dimension1);
            case SQUARE -> squareSpiralPath(anchor, direction, dimension1);
            case CIRCULAR -> circularSpiralPath(anchor, direction, dimension1);
            default -> List.of();
        };
    }

    public List<StairExit> generatedExits(
            List<StairExit> existingExits,
            List<Long> reservedExitIds
    ) {
        List<Cell> path = generatedPath();
        if (path.isEmpty() || dimension2 <= 0) {
            return List.of();
        }
        Map<Integer, Long> exitIdsByLevel = existingExitIdsByLevel(
                Objects.requireNonNull(existingExits, "existingExits"));
        List<Long> reservedIds = Objects.requireNonNull(reservedExitIds, "reservedExitIds");
        List<StairExit> exits = new ArrayList<>();
        int reservedIndex = 0;
        for (int levelOffset = 0; levelOffset <= dimension2; levelOffset++) {
            int pathStep = (int) Math.round((double) (path.size() - 1) * levelOffset / dimension2);
            Cell pathCell = path.get(pathStep);
            Cell exitCell = new Cell(pathCell.q(), pathCell.r(), anchor.level() + levelOffset);
            long exitId = exitIdsByLevel.getOrDefault(levelOffset, 0L);
            if (exitId <= 0L) {
                if (reservedIndex >= reservedIds.size()) {
                    throw new IllegalStateException("stair-exit identity reservation exhausted");
                }
                Long reservedId = reservedIds.get(reservedIndex++);
                if (reservedId == null || reservedId <= 0L) {
                    throw new IllegalArgumentException("stair-exit identities must be positive");
                }
                exitId = reservedId;
            }
            exits.add(new StairExit(exitId, exitCell, ""));
        }
        return List.copyOf(exits);
    }

    public List<Cell> generatedExitCells() {
        List<Cell> path = generatedPath();
        if (path.isEmpty() || dimension2 <= 0) {
            return List.of();
        }
        List<Cell> exits = new ArrayList<>();
        for (int levelOffset = 0; levelOffset <= dimension2; levelOffset++) {
            int pathStep = (int) Math.round((double) (path.size() - 1) * levelOffset / dimension2);
            Cell pathCell = path.get(pathStep);
            exits.add(new Cell(pathCell.q(), pathCell.r(), anchor.level() + levelOffset));
        }
        return List.copyOf(exits);
    }

    public boolean avoidsRoomInteriors(Set<Cell> roomCells) {
        List<Cell> path = generatedPath();
        if (new LinkedHashSet<>(path).size() != path.size()) {
            return false;
        }
        Set<Cell> safeRoomCells = roomCells == null ? Set.of() : Set.copyOf(roomCells);
        if (safeRoomCells.isEmpty()) {
            return true;
        }
        Set<Cell> exits = new LinkedHashSet<>();
        exits.addAll(generatedExitCells());
        for (Cell pathCell : path) {
            if (safeRoomCells.contains(pathCell) && !exits.contains(pathCell)) {
                return false;
            }
        }
        return true;
    }

    private Map<Integer, Long> existingExitIdsByLevel(List<StairExit> existingExits) {
        Map<Integer, Long> result = new HashMap<>();
        List<StairExit> safeExistingExits = existingExits.stream().filter(Objects::nonNull).toList();
        int firstExistingLevel = safeExistingExits.stream()
                .mapToInt(exit -> exit.position().level())
                .min()
                .orElse(anchor.level());
        for (StairExit exit : safeExistingExits) {
            if (exit != null && exit.exitId() > 0L) {
                result.putIfAbsent(exit.position().level() - firstExistingLevel, exit.exitId());
            }
        }
        return Map.copyOf(result);
    }

    private static List<Cell> straightPath(
            Cell anchor,
            Direction direction,
            int dimension1
    ) {
        List<Cell> path = new ArrayList<>();
        for (int step = 0; step < dimension1; step++) {
            path.add(localCell(anchor, direction, step, 0));
        }
        return List.copyOf(path);
    }

    private static List<Cell> squareSpiralPath(
            Cell anchor,
            Direction direction,
            int sideLength
    ) {
        List<Cell> path = new ArrayList<>();
        for (int min = 0, max = sideLength - 1; min <= max; min++, max--) {
            appendSquareRing(path, anchor, direction, min, max);
        }
        return List.copyOf(path);
    }

    private static void appendSquareRing(
            List<Cell> path,
            Cell anchor,
            Direction direction,
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

    private static List<Cell> circularSpiralPath(
            Cell anchor,
            Direction direction,
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
        candidates.sort(StairGeometrySpec::compareCircularCells);
        List<Cell> path = new ArrayList<>();
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

    private static Cell localCell(
            Cell anchor,
            Direction direction,
            int forward,
            int right
    ) {
        Direction rightDirection = rightTurn(direction);
        return new Cell(
                anchor.q() + direction.deltaQ() * forward + rightDirection.deltaQ() * right,
                anchor.r() + direction.deltaR() * forward + rightDirection.deltaR() * right,
                anchor.level());
    }

    private static Direction rightTurn(Direction direction) {
        if (direction == Direction.EAST) {
            return Direction.SOUTH;
        }
        if (direction == Direction.SOUTH) {
            return Direction.WEST;
        }
        if (direction == Direction.WEST) {
            return Direction.NORTH;
        }
        return Direction.EAST;
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
