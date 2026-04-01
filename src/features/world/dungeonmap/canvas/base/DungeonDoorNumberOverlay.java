package features.world.dungeonmap.canvas.base;

import features.world.dungeonmap.model.geometry.VertexEdge;

public record DungeonDoorNumberOverlay(
        int number,
        VertexEdge anchorEdge
) {
    public DungeonDoorNumberOverlay {
        number = number <= 0 ? 1 : number;
    }
}
