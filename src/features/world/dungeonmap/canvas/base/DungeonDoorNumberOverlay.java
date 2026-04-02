package features.world.dungeonmap.canvas.base;

import features.world.dungeonmap.model.geometry.GridSegment2x;

public record DungeonDoorNumberOverlay(
        int number,
        GridSegment2x anchorSegment2x
) {
    public DungeonDoorNumberOverlay {
        number = number <= 0 ? 1 : number;
    }
}
