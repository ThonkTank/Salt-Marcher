package features.world.dungeonmap.model.geometry;

import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Canonical 3D cube-grid coordinate for dungeon traversal and vertical projection.
 *
 * <p>The dungeon canvas still renders a 2D projection, but model/runtime identity lives on the full cube
 * coordinate so stairs and reachable layers can be expressed without parallel level state.</p>
 */
public record CubePoint(int x, int y, int z) {

    public static final Comparator<CubePoint> POINT_ORDER = Comparator
            .comparingInt(CubePoint::z)
            .thenComparingInt(CubePoint::y)
            .thenComparingInt(CubePoint::x);

    public static final List<CubePoint> FACE_STEPS = List.of(
            new CubePoint(1, 0, 0),
            new CubePoint(-1, 0, 0),
            new CubePoint(0, 1, 0),
            new CubePoint(0, -1, 0),
            new CubePoint(0, 0, 1),
            new CubePoint(0, 0, -1));

    public CubePoint add(CubePoint other) {
        return other == null ? this : new CubePoint(x + other.x, y + other.y, z + other.z);
    }

    public CubePoint subtract(CubePoint other) {
        return other == null ? this : new CubePoint(x - other.x, y - other.y, z - other.z);
    }

    public CubePoint withZ(int nextZ) {
        return z == nextZ ? this : new CubePoint(x, y, nextZ);
    }

    public Point2i projectedCell() {
        return new Point2i(x, y);
    }

    public int manhattanDistanceTo(CubePoint other) {
        return other == null ? Integer.MAX_VALUE : Math.abs(x - other.x) + Math.abs(y - other.y) + Math.abs(z - other.z);
    }

    public Set<CubePoint> neighbors6() {
        Set<CubePoint> neighbors = new LinkedHashSet<>();
        for (CubePoint step : FACE_STEPS) {
            neighbors.add(add(step));
        }
        return Set.copyOf(neighbors);
    }

    public static CubePoint at(Point2i cell, int z) {
        return cell == null ? new CubePoint(0, 0, z) : new CubePoint(cell.x(), cell.y(), z);
    }
}
