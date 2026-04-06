package features.world.dungeonmap.model.objects;

import features.world.dungeonmap.model.geometry.CubePoint;

public record StairExit(
        CubePoint position,
        String label
) {
    public StairExit {
        position = position == null ? new CubePoint(0, 0, 0) : position;
        label = label == null || label.isBlank()
                ? "Ausgang z=" + position.z() + " (" + position.x() + "," + position.y() + ")"
                : label.trim();
    }
}
