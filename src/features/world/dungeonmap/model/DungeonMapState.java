package features.world.dungeonmap.model;

import java.util.List;

public record DungeonMapState(
        DungeonMap map,
        List<DungeonSquare> squares,
        List<DungeonRoom> rooms,
        List<DungeonArea> areas,
        List<DungeonEndpoint> endpoints,
        List<DungeonLink> links,
        List<DungeonPassage> passages
) {
}
