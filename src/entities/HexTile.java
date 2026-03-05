package entities;

import java.util.List;

public class HexTile {
    public Long TileId;
    public Long MapId;
    public int Q;
    public int R;
    /** Visual terrain category for map rendering. Values: grassland, mountain, water, forest, desert, swamp */
    public String TerrainType;
    public int Elevation;        // 0 = sea level
    /**
     * Encounter-filter biome — same vocabulary as creature_biomes.
     * A water tile typically uses biome="coastal". May be null if not yet assigned.
     * Values: arctic, coastal, desert, forest, grassland, mountain, swamp, underdark
     */
    public String Biome;
    public boolean IsExplored;
    public Long DominantFactionId;
    public String Notes;

    /** Hex distance in axial coordinates using cube-coordinate formula. */
    public static int distance(int q1, int r1, int q2, int r2) {
        int dq = q1 - q2;
        int dr = r1 - r2;
        return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
    }

    /** Returns the axial coordinates of the 6 adjacent tiles. */
    public static List<int[]> neighborCoords(int q, int r) {
        return List.of(
            new int[]{q + 1, r},
            new int[]{q - 1, r},
            new int[]{q, r + 1},
            new int[]{q, r - 1},
            new int[]{q + 1, r - 1},
            new int[]{q - 1, r + 1}
        );
    }
}
