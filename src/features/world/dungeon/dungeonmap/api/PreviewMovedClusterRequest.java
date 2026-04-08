package features.world.dungeon.dungeonmap.api;

import features.world.dungeon.dungeonmap.model.DungeonMap;
import features.world.dungeon.geometry.GridTranslation;

import java.util.Objects;

public record PreviewMovedClusterRequest(
        DungeonMap map,
        Long clusterId,
        GridTranslation translation
) {
    public PreviewMovedClusterRequest {
        map = Objects.requireNonNull(map, "map");
        translation = translation == null ? GridTranslation.none() : translation;
    }
}
