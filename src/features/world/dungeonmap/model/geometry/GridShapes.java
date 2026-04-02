package features.world.dungeonmap.model.geometry;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Set;

/**
 * Central factory surface for lightweight 2x render and hit shapes.
 */
public final class GridShapes {

    private GridShapes() {
        throw new AssertionError("No instances");
    }

    public static TileFaceShape tile(Point2i cell) {
        return new TileFaceShape(cell == null ? Set.of() : Set.of(cell));
    }

    public static TileFaceShape tile(Collection<Point2i> cells) {
        return new TileFaceShape(cells);
    }

    public static EdgePathShape edge(GridSegment2x segment) {
        return new EdgePathShape(segment == null ? List.of() : List.of(segment));
    }

    public static EdgePathShape edge(Collection<GridSegment2x> segments) {
        return new EdgePathShape(segments);
    }

    public static VertexShape vertex(GridPoint2x point) {
        return new VertexShape(point == null ? Set.of() : Set.of(point));
    }

    public static VertexShape vertex(Collection<GridPoint2x> points) {
        return new VertexShape(points);
    }

    public static GridShape polyline(List<GridPoint2x> points) {
        List<GridPoint2x> normalizedPoints = normalizePolylinePoints(points);
        if (normalizedPoints.isEmpty()) {
            return new CompositeShape(List.of());
        }
        if (normalizedPoints.size() == 1) {
            return vertex(normalizedPoints.getFirst());
        }
        ArrayList<GridSegment2x> segments = new ArrayList<>();
        for (int index = 1; index < normalizedPoints.size(); index++) {
            segments.add(new GridSegment2x(normalizedPoints.get(index - 1), normalizedPoints.get(index)));
        }
        return new EdgePathShape(segments);
    }

    public static GridShape translate(GridShape shape, Point2i delta) {
        return shape == null ? new CompositeShape(List.of()) : shape.translatedByCells(delta);
    }

    public static CompositeShape union(GridShape... shapes) {
        if (shapes == null || shapes.length == 0) {
            return new CompositeShape(List.of());
        }
        ArrayList<GridShape> resolvedShapes = new ArrayList<>();
        for (GridShape shape : shapes) {
            resolvedShapes.add(shape);
        }
        return union(resolvedShapes);
    }

    public static CompositeShape union(Collection<? extends GridShape> shapes) {
        return new CompositeShape(shapes);
    }

    public static GridBounds2x bounds(GridShape shape) {
        return shape == null ? GridBounds2x.empty() : shape.bounds();
    }

    public static GridBounds2x bounds(Collection<? extends GridShape> shapes) {
        return union(shapes).bounds();
    }

    private static List<GridPoint2x> normalizePolylinePoints(Collection<GridPoint2x> points) {
        ArrayList<GridPoint2x> result = new ArrayList<>();
        GridPoint2x previous = null;
        if (points != null) {
            for (GridPoint2x point : points) {
                if (point == null) {
                    continue;
                }
                if (point.equals(previous)) {
                    continue;
                }
                result.add(point);
                previous = point;
            }
        }
        return List.copyOf(result);
    }
}
