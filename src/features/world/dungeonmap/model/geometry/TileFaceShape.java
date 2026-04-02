package features.world.dungeonmap.model.geometry;

import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.Set;

/**
 * Absolute tile-area shape on the dungeon cell grid.
 */
public record TileFaceShape(Set<Point2i> cells) {

    public TileFaceShape {
        cells = normalizeCells(cells);
    }

    public TileFaceShape(Collection<Point2i> cells) {
        this(cells == null ? Set.of() : new LinkedHashSet<>(cells));
    }

    public boolean contains(Point2i cell) {
        return cell != null && cells.contains(cell);
    }

    public int size() {
        return cells.size();
    }

    public GridBounds2x bounds() {
        if (cells.isEmpty()) {
            return GridBounds2x.empty();
        }
        int minX2 = Integer.MAX_VALUE;
        int minY2 = Integer.MAX_VALUE;
        int maxX2 = Integer.MIN_VALUE;
        int maxY2 = Integer.MIN_VALUE;
        for (Point2i cell : cells) {
            minX2 = Math.min(minX2, cell.x() * 2);
            minY2 = Math.min(minY2, cell.y() * 2);
            maxX2 = Math.max(maxX2, cell.x() * 2 + 2);
            maxY2 = Math.max(maxY2, cell.y() * 2 + 2);
        }
        return new GridBounds2x(minX2, minY2, maxX2, maxY2);
    }

    public TileFaceShape translatedByCells(Point2i delta) {
        Point2i resolvedDelta = delta == null ? new Point2i(0, 0) : delta;
        if (resolvedDelta.x() == 0 && resolvedDelta.y() == 0) {
            return this;
        }
        LinkedHashSet<Point2i> translated = new LinkedHashSet<>();
        for (Point2i cell : cells) {
            translated.add(cell.add(resolvedDelta));
        }
        return new TileFaceShape(translated);
    }

    public boolean isEmpty() {
        return cells.isEmpty();
    }

    private static Set<Point2i> normalizeCells(Collection<Point2i> input) {
        LinkedHashSet<Point2i> result = new LinkedHashSet<>();
        if (input != null) {
            for (Point2i cell : input) {
                if (cell != null) {
                    result.add(cell);
                }
            }
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }
}
