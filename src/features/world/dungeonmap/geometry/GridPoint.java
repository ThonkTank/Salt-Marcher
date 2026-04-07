package features.world.dungeonmap.geometry;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;

public final class GridPoint extends GridObject {

    public enum Kind {
        CELL,
        EDGE,
        VERTEX
    }

    public static final Comparator<GridPoint> ORDER = Comparator
            .comparingInt(GridPoint::z)
            .thenComparingInt(GridPoint::y2)
            .thenComparingInt(GridPoint::x2);
    public static final Comparator<GridPoint> POINT_ORDER = ORDER;
    public static final List<GridPoint> CARDINAL_STEPS = List.of(
            new GridPoint(0, -1),
            new GridPoint(1, 0),
            new GridPoint(0, 1),
            new GridPoint(-1, 0));

    private final int x2;
    private final int y2;
    private final int z;

    public GridPoint(int x, int y) {
        this(x * 2, y * 2, 0, true);
    }

    public GridPoint(int x, int y, int z) {
        this(x * 2, y * 2, z, true);
    }

    private GridPoint(int x2, int y2, int z, boolean cellCoords) {
        this.x2 = x2;
        this.y2 = y2;
        this.z = z;
    }

    public static GridPoint raw(int x2, int y2) {
        return new GridPoint(x2, y2, 0, false);
    }

    public static GridPoint raw(int x2, int y2, int z) {
        return new GridPoint(x2, y2, z, false);
    }

    public static GridPoint cell(GridPoint point) {
        GridPoint resolvedPoint = Objects.requireNonNull(point, "point");
        return resolvedPoint.isCell() ? resolvedPoint : new GridPoint(resolvedPoint.x(), resolvedPoint.y(), resolvedPoint.z());
    }

    public static GridPoint edgeCenter(GridPoint cell, CardinalDirection dir) {
        GridPoint resolvedCell = cell(Objects.requireNonNull(cell, "cell"));
        CardinalDirection resolvedDirection = Objects.requireNonNull(dir, "dir");
        GridPoint delta = resolvedDirection.delta();
        return resolvedCell.offset2x(delta.x(), delta.y());
    }

    public static GridPoint vertex(GridPoint baseCell, int dx, int dy) {
        GridPoint resolvedCell = cell(Objects.requireNonNull(baseCell, "baseCell"));
        if ((dx != -1 && dx != 1) || (dy != -1 && dy != 1)) {
            throw new IllegalArgumentException("GridPoint.vertex requires dx/dy in {-1,+1}");
        }
        return resolvedCell.offset2x(dx, dy);
    }

    public static GridPoint at(GridPoint cell, int z) {
        return cell == null ? new GridPoint(0, 0, z) : new GridPoint(cell.x(), cell.y(), z);
    }

    public int x() {
        return x2 / 2;
    }

    public int y() {
        return y2 / 2;
    }

    public int x2() {
        return x2;
    }

    public int y2() {
        return y2;
    }

    public int z() {
        return z;
    }

    public Kind kind() {
        boolean oddX = (x2 & 1) != 0;
        boolean oddY = (y2 & 1) != 0;
        if (!oddX && !oddY) {
            return Kind.CELL;
        }
        if (oddX && oddY) {
            return Kind.VERTEX;
        }
        return Kind.EDGE;
    }

    public boolean isCell() {
        return kind() == Kind.CELL;
    }

    public boolean isEdge() {
        return kind() == Kind.EDGE;
    }

    public boolean isVertex() {
        return kind() == Kind.VERTEX;
    }

    public Optional<GridPoint> asCell() {
        if (!isCell()) {
            return Optional.empty();
        }
        return Optional.of(this);
    }

    public GridPoint projectedCell() {
        return new GridPoint(x(), y(), z);
    }

    public GridPoint add(GridPoint other) {
        return other == null ? this : new GridPoint(x2 + other.x2, y2 + other.y2, z + other.z, false);
    }

    public GridPoint subtract(GridPoint other) {
        return other == null ? this : new GridPoint(x2 - other.x2, y2 - other.y2, z - other.z, false);
    }

    public Set<GridPoint> neighbors4() {
        LinkedHashSet<GridPoint> neighbors = new LinkedHashSet<>();
        for (GridPoint step : CARDINAL_STEPS) {
            neighbors.add(add(step));
        }
        return Set.copyOf(neighbors);
    }

    public boolean isAdjacent4(GridPoint other) {
        return directionTo4(other) != null;
    }

    public CardinalDirection directionTo4(GridPoint other) {
        if (other == null) {
            return null;
        }
        return CardinalDirection.fromDirection(other.subtract(this));
    }

    public int manhattanDistance(GridPoint other) {
        return other == null ? Integer.MAX_VALUE : Math.abs(x() - other.x()) + Math.abs(y() - other.y());
    }

    public int manhattanDistanceTo(GridPoint other) {
        return other == null ? Integer.MAX_VALUE : Math.abs(x() - other.x()) + Math.abs(y() - other.y()) + Math.abs(z - other.z);
    }

    public int manhattanDistance2x(GridPoint other) {
        GridPoint resolvedOther = Objects.requireNonNull(other, "other");
        return Math.abs(x2 - resolvedOther.x2) + Math.abs(y2 - resolvedOther.y2);
    }

    public GridPoint offset2x(int dx2, int dy2) {
        if (dx2 == 0 && dy2 == 0) {
            return this;
        }
        return new GridPoint(x2 + dx2, y2 + dy2, z, false);
    }

    @Override
    public GridPoint translatedByCells(int dx, int dy, int dz) {
        if (dx == 0 && dy == 0 && dz == 0) {
            return this;
        }
        return new GridPoint(x2 + dx * 2, y2 + dy * 2, z + dz, false);
    }

    public GridPoint translatedByCells(GridPoint delta) {
        GridPoint resolvedDelta = delta == null ? new GridPoint(0, 0) : delta;
        return translatedByCells(resolvedDelta.x(), resolvedDelta.y(), resolvedDelta.z());
    }

    public long encodedKey() {
        return 31L * (31L * x2 + y2) + z;
    }

    public Set<GridPoint> touchingCells() {
        return switch (kind()) {
            case CELL -> Set.of(this);
            case EDGE -> touchingCellsForEdge();
            case VERTEX -> touchingCellsForVertex();
        };
    }

    @Override
    public Set<Integer> levels() {
        return Set.of(z);
    }

    @Override
    public GridArea cellFootprint() {
        return new GridArea(touchingCells());
    }

    public static Set<GridPoint> normalize(Collection<GridPoint> points) {
        LinkedHashSet<GridPoint> result = new LinkedHashSet<>();
        if (points != null) {
            points.stream()
                    .filter(Objects::nonNull)
                    .sorted(ORDER)
                    .forEach(result::add);
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    public static GridPoint bestCenter(Collection<GridPoint> points) {
        Set<GridPoint> normalizedPoints = normalize(points);
        if (normalizedPoints.isEmpty()) {
            return new GridPoint(0, 0);
        }
        double averageX = normalizedPoints.stream().mapToInt(GridPoint::x).average().orElse(0.0);
        double averageY = normalizedPoints.stream().mapToInt(GridPoint::y).average().orElse(0.0);
        int levelZ = normalizedPoints.stream().findFirst().map(GridPoint::z).orElse(0);
        return normalizedPoints.stream()
                .min(Comparator
                        .comparingDouble((GridPoint point) -> squaredDistance(point, averageX, averageY))
                        .thenComparing(ORDER))
                .orElse(new GridPoint(0, 0, levelZ));
    }

    public static List<Set<GridPoint>> connectedComponents(Collection<GridPoint> points) {
        Set<GridPoint> normalizedPoints = normalize(points);
        if (normalizedPoints.isEmpty()) {
            return List.of();
        }
        LinkedHashSet<GridPoint> remaining = new LinkedHashSet<>(normalizedPoints);
        ArrayList<Set<GridPoint>> result = new ArrayList<>();
        while (!remaining.isEmpty()) {
            GridPoint seed = remaining.iterator().next();
            ArrayDeque<GridPoint> queue = new ArrayDeque<>();
            LinkedHashSet<GridPoint> component = new LinkedHashSet<>();
            queue.add(seed);
            remaining.remove(seed);
            while (!queue.isEmpty()) {
                GridPoint current = queue.removeFirst();
                if (!component.add(current)) {
                    continue;
                }
                for (GridPoint step : CARDINAL_STEPS) {
                    GridPoint neighbor = current.add(step);
                    if (remaining.remove(neighbor)) {
                        queue.addLast(neighbor);
                    }
                }
            }
            result.add(Set.copyOf(component));
        }
        return List.copyOf(result);
    }

    public static Set<GridPoint> componentCenters(Collection<GridPoint> points) {
        LinkedHashSet<GridPoint> result = connectedComponents(points).stream()
                .map(GridPoint::bestCenter)
                .sorted(ORDER)
                .collect(LinkedHashSet::new, Set::add, Set::addAll);
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    public static CardinalDirection fromTravel(GridPoint from, GridPoint to, CardinalDirection fallback) {
        if (from == null || to == null) {
            return fallback == null ? CardinalDirection.defaultDirection() : fallback;
        }
        int deltaX = to.x() - from.x();
        int deltaY = to.y() - from.y();
        if (deltaX == 0 && deltaY == 0) {
            return fallback == null ? CardinalDirection.defaultDirection() : fallback;
        }
        if (Math.abs(deltaX) >= Math.abs(deltaY)) {
            return deltaX >= 0 ? CardinalDirection.EAST : CardinalDirection.WEST;
        }
        return deltaY >= 0 ? CardinalDirection.SOUTH : CardinalDirection.NORTH;
    }

    private Set<GridPoint> touchingCellsForEdge() {
        if ((x2 & 1) != 0) {
            int cellY = y2 / 2;
            return Set.of(
                    new GridPoint((x2 - 1) / 2, cellY, z),
                    new GridPoint((x2 + 1) / 2, cellY, z));
        }
        int cellX = x2 / 2;
        return Set.of(
                new GridPoint(cellX, (y2 - 1) / 2, z),
                new GridPoint(cellX, (y2 + 1) / 2, z));
    }

    private Set<GridPoint> touchingCellsForVertex() {
        int westX = (x2 - 1) / 2;
        int eastX = (x2 + 1) / 2;
        int northY = (y2 - 1) / 2;
        int southY = (y2 + 1) / 2;
        return Set.of(
                new GridPoint(westX, northY, z),
                new GridPoint(eastX, northY, z),
                new GridPoint(westX, southY, z),
                new GridPoint(eastX, southY, z));
    }

    private static double squaredDistance(GridPoint point, double centerX, double centerY) {
        double deltaX = point.x() - centerX;
        double deltaY = point.y() - centerY;
        return deltaX * deltaX + deltaY * deltaY;
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof GridPoint point)) {
            return false;
        }
        return x2 == point.x2 && y2 == point.y2 && z == point.z;
    }

    @Override
    public int hashCode() {
        return Objects.hash(x2, y2, z);
    }

    @Override
    public String toString() {
        return "GridPoint[x2=" + x2 + ", y2=" + y2 + ", z=" + z + "]";
    }
}
