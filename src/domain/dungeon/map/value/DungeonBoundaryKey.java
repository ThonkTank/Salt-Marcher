package src.domain.dungeon.map.value;

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
}
