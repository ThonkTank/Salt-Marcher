package features.world.dungeonmap.model.geometry;

import java.util.Comparator;

/**
 * Canonical 3D cube-grid coordinate for dungeon runtime identity and vertical projection.
 *
 * <p>The dungeon canvas still renders a 2D projection, but model/runtime identity lives on the full cube
 * coordinate so stairs and reachable layers can be expressed without parallel level state.</p>
 */
public record CubePoint(int x, int y, int z) {

    public static final Comparator<CubePoint> POINT_ORDER = Comparator
            .comparingInt(CubePoint::z)
            .thenComparingInt(CubePoint::y)
            .thenComparingInt(CubePoint::x);

    public CubePoint add(CubePoint other) {
        return other == null ? this : new CubePoint(x + other.x, y + other.y, z + other.z);
    }

    public CubePoint subtract(CubePoint other) {
        return other == null ? this : new CubePoint(x - other.x, y - other.y, z - other.z);
    }

    public CellCoord projectedCell() {
        return new CellCoord(x, y);
    }

    public Point2i projectedPoint2i() {
        return projectedCell().toPoint2i();
    }

    public int manhattanDistanceTo(CubePoint other) {
        return other == null ? Integer.MAX_VALUE : Math.abs(x - other.x) + Math.abs(y - other.y) + Math.abs(z - other.z);
    }



    public static CubePoint at(Point2i cell, int z) {
        return at(CellCoord.fromPoint(cell), z);
    }

    public static CubePoint at(CellCoord cell, int z) {
        return cell == null ? new CubePoint(0, 0, z) : new CubePoint(cell.x(), cell.y(), z);
    }
}
