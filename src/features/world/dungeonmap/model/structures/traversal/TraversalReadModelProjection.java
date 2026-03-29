package features.world.dungeonmap.model.structures.traversal;

import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.stair.DungeonStair;

import java.util.List;

public record TraversalReadModelProjection(
        List<Corridor> corridors,
        List<DungeonStair> stairs
) {
    public TraversalReadModelProjection {
        corridors = corridors == null ? List.of() : List.copyOf(corridors);
        stairs = stairs == null ? List.of() : List.copyOf(stairs);
    }
}
