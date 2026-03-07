package features.world.hexmap.model;

import java.util.List;

public final class HexGeometry {
    private HexGeometry() {
        throw new AssertionError("No instances");
    }

    /** Hex distance in axial coordinates using cube-coordinate formula. */
    public static int distance(int q1, int r1, int q2, int r2) {
        int dq = q1 - q2;
        int dr = r1 - r2;
        return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
    }

    /** Returns the axial coordinates of the 6 adjacent tiles. */
    public static List<AxialCoord> neighborCoords(int q, int r) {
        return List.of(
                new AxialCoord(q + 1, r),
                new AxialCoord(q - 1, r),
                new AxialCoord(q, r + 1),
                new AxialCoord(q, r - 1),
                new AxialCoord(q + 1, r - 1),
                new AxialCoord(q - 1, r + 1)
        );
    }
}
