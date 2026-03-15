package features.world.dungeonmap.model;

import java.util.List;

public record DungeonLayout(
        DungeonMap map,
        List<DungeonRoom> rooms,
        List<DungeonCorridor> corridors
) {
}
