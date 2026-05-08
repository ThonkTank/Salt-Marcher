package src.data.dungeon.model;

import java.util.List;
import org.jspecify.annotations.Nullable;

public record DungeonStairRecord(
        long stairId,
        long mapId,
        String name,
        String shape,
        int direction,
        int dimension1,
        int dimension2,
        @Nullable Long corridorId,
        List<DungeonStairPathNodeRecord> pathNodes,
        List<DungeonStairExitRecord> exits
) {

    public DungeonStairRecord {
        shape = shape == null || shape.isBlank() ? "LADDER" : shape;
        dimension1 = Math.max(0, dimension1);
        dimension2 = Math.max(0, dimension2);
        corridorId = DungeonRecordIdNormalizer.positiveLongOrNull(corridorId);
        pathNodes = pathNodes == null ? List.of() : List.copyOf(pathNodes);
        exits = exits == null ? List.of() : List.copyOf(exits);
    }
}
