package features.world.dungeon.geometry;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
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

    private final int x2;
    private final int y2;
    private final int z;

    private GridPoint(int x2, int y2, int z, boolean lattice) {
        this.x2 = x2;
        this.y2 = y2;
        this.z = z;
    }

    public static GridPoint lattice(int x2, int y2, int z) {
        return new GridPoint(x2, y2, z, true);
    }

    public static GridPoint cell(int x, int y, int z) {
        return new GridPoint(x * 2, y * 2, z, true);
    }

    public static GridPoint vertex(GridPoint baseCell, int dx, int dy) {
        GridPoint resolvedBaseCell = Objects.requireNonNull(baseCell, "baseCell");
        if (resolvedBaseCell.kind() != Kind.CELL) {
            throw new IllegalArgumentException("baseCell must be a cell");
        }
        if (Math.abs(dx) != 1 || Math.abs(dy) != 1) {
            throw new IllegalArgumentException("vertex offsets must be +/-1");
        }
        return new GridPoint(resolvedBaseCell.x2 + dx, resolvedBaseCell.y2 + dy, resolvedBaseCell.z, true);
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

    public GridPoint withLevel(int levelZ) {
        return levelZ == z ? this : new GridPoint(x2, y2, levelZ, true);
    }

    public GridPoint step(CardinalDirection direction) {
        CardinalDirection resolvedDirection = Objects.requireNonNull(direction, "direction");
        return new GridPoint(
                x2 + resolvedDirection.dxCells() * 2,
                y2 + resolvedDirection.dyCells() * 2,
                z,
                true);
    }

    public CardinalDirection cardinalDirectionTo(GridPoint other) {
        if (other == null || kind() != Kind.CELL || other.kind() != Kind.CELL || z != other.z) {
            return null;
        }
        int dx2 = other.x2 - x2;
        int dy2 = other.y2 - y2;
        for (CardinalDirection direction : CardinalDirection.values()) {
            if (dx2 == direction.dxCells() * 2 && dy2 == direction.dyCells() * 2) {
                return direction;
            }
        }
        return null;
    }

    public GridArea touchingCells() {
        return GridArea.of(touchingCellSet());
    }

    @Override
    public GridPoint translated(GridTranslation translation) {
        GridTranslation resolvedTranslation = translation == null ? GridTranslation.none() : translation;
        if (resolvedTranslation.isZero()) {
            return this;
        }
        return new GridPoint(
                x2 + resolvedTranslation.dxCells() * 2,
                y2 + resolvedTranslation.dyCells() * 2,
                z + resolvedTranslation.dzLevels(),
                true);
    }

    @Override
    public Set<Integer> levels() {
        return Set.of(z);
    }

    @Override
    public GridArea cellFootprint() {
        return touchingCells();
    }

    static Set<GridPoint> normalizeCells(Collection<GridPoint> points) {
        LinkedHashSet<GridPoint> result = new LinkedHashSet<>();
        if (points != null) {
            points.stream()
                    .filter(Objects::nonNull)
                    .filter(point -> point.kind() == Kind.CELL)
                    .sorted(ORDER)
                    .forEach(result::add);
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    static GridPoint centerOfCells(Collection<GridPoint> points) {
        Set<GridPoint> normalizedPoints = normalizeCells(points);
        if (normalizedPoints.isEmpty()) {
            return null;
        }
        double averageX2 = normalizedPoints.stream().mapToInt(GridPoint::x2).average().orElse(0.0);
        double averageY2 = normalizedPoints.stream().mapToInt(GridPoint::y2).average().orElse(0.0);
        return normalizedPoints.stream()
                .min(Comparator
                        .comparingDouble((GridPoint point) -> squaredDistance2(point, averageX2, averageY2))
                        .thenComparing(ORDER))
                .orElse(null);
    }

    static List<Set<GridPoint>> connectedCellComponents(Collection<GridPoint> points) {
        Set<GridPoint> remaining = new LinkedHashSet<>(normalizeCells(points));
        if (remaining.isEmpty()) {
            return List.of();
        }
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
                for (CardinalDirection direction : CardinalDirection.values()) {
                    GridPoint neighbor = current.step(direction);
                    if (remaining.remove(neighbor)) {
                        queue.addLast(neighbor);
                    }
                }
            }
            result.add(Set.copyOf(component));
        }
        return List.copyOf(result);
    }

    Set<GridPoint> touchingCellSet() {
        return switch (kind()) {
            case CELL -> Set.of(this);
            case EDGE -> touchingCellsForEdge();
            case VERTEX -> touchingCellsForVertex();
        };
    }

    public int cellX() {
        if (kind() != Kind.CELL) {
            throw new IllegalStateException("GridPoint is not a cell");
        }
        return x2 / 2;
    }

    public int cellY() {
        if (kind() != Kind.CELL) {
            throw new IllegalStateException("GridPoint is not a cell");
        }
        return y2 / 2;
    }

    private Set<GridPoint> touchingCellsForEdge() {
        LinkedHashSet<GridPoint> result = new LinkedHashSet<>();
        if ((x2 & 1) != 0) {
            result.add(new GridPoint(x2 - 1, y2, z, true));
            result.add(new GridPoint(x2 + 1, y2, z, true));
        } else {
            result.add(new GridPoint(x2, y2 - 1, z, true));
            result.add(new GridPoint(x2, y2 + 1, z, true));
        }
        return Set.copyOf(result);
    }

    private Set<GridPoint> touchingCellsForVertex() {
        LinkedHashSet<GridPoint> result = new LinkedHashSet<>();
        result.add(new GridPoint(x2 - 1, y2 - 1, z, true));
        result.add(new GridPoint(x2 + 1, y2 - 1, z, true));
        result.add(new GridPoint(x2 - 1, y2 + 1, z, true));
        result.add(new GridPoint(x2 + 1, y2 + 1, z, true));
        return Set.copyOf(result);
    }

    private static double squaredDistance2(GridPoint point, double centerX2, double centerY2) {
        double dx = point.x2 - centerX2;
        double dy = point.y2 - centerY2;
        return dx * dx + dy * dy;
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
