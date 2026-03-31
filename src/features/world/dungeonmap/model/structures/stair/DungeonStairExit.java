package features.world.dungeonmap.model.structures.stair;

import features.world.dungeonmap.model.geometry.CubePoint;

public record DungeonStairExit(
        CubePoint position,
        String label
) {
    public DungeonStairExit {
        position = position == null ? new CubePoint(0, 0, 0) : position;
        label = label == null || label.isBlank()
                ? "Ausgang z=" + position.z() + " (" + position.x() + "," + position.y() + ")"
                : label.trim();
    }
}
