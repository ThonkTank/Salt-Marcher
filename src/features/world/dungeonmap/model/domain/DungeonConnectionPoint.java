package features.world.dungeonmap.model.domain;

public record DungeonConnectionPoint(
        Long connectionPointId,
        Long connectionId,
        int sortOrder,
        int x,
        int y
) {
    public DungeonConnectionPoint {
        if (connectionId == null || connectionId <= 0) {
            throw new IllegalArgumentException("connectionId must be positive");
        }
        if (sortOrder < 0) {
            throw new IllegalArgumentException("sortOrder must not be negative");
        }
    }
}
