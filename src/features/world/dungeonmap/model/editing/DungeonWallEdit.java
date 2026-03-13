package features.world.dungeonmap.model.editing;

import features.world.dungeonmap.model.domain.PassageDirection;

public record DungeonWallEdit(
        int x,
        int y,
        PassageDirection direction,
        boolean wallPresent
) {
    public String edgeKey() {
        return direction.edgeKey(x, y);
    }
}
