package src.domain.dungeon.model.map.model;

import java.util.Comparator;

public record DungeonBoundaryKey(
        DungeonCell lower,
        DungeonCell upper
) {

    public static DungeonBoundaryKey from(DungeonEdge edge) {
        DungeonCell from = edge.from();
        DungeonCell to = edge.to();
        int comparison = Comparator
                .comparingInt(DungeonCell::level)
                .thenComparingInt(DungeonCell::r)
                .thenComparingInt(DungeonCell::q)
                .compare(from, to);
        return comparison <= 0 ? new DungeonBoundaryKey(from, to) : new DungeonBoundaryKey(to, from);
    }

    public long stableId() {
        long hash = 17L;
        hash = 31L * hash + cellHash(lower);
        hash = 31L * hash + cellHash(upper);
        return Math.max(1L, Math.abs(hash));
    }

    private static long cellHash(DungeonCell cell) {
        if (cell == null) {
            return 0L;
        }
        long hash = 17L;
        hash = 31L * hash + cell.q();
        hash = 31L * hash + cell.r();
        hash = 31L * hash + cell.level();
        return hash;
    }
}
