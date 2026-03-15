package features.world.dungeonmap.model.domain;

public record DungeonConceptLevel(
        Long conceptLevelId,
        Long mapId,
        int sortOrder,
        int startLevel,
        int endLevel,
        double progressFraction,
        double adventuringDaysTarget,
        int entranceCount,
        int exitCount
) {
    public DungeonConceptLevel {
        if (mapId == null || mapId <= 0) {
            throw new IllegalArgumentException("mapId must be positive");
        }
        if (sortOrder <= 0) {
            throw new IllegalArgumentException("sortOrder must be positive");
        }
        if (startLevel < 1 || startLevel > 20 || endLevel < 1 || endLevel > 20 || startLevel > endLevel) {
            throw new IllegalArgumentException("Invalid concept level range");
        }
        if (progressFraction < 0.0) {
            throw new IllegalArgumentException("progressFraction must not be negative");
        }
        if (adventuringDaysTarget < 0.0) {
            throw new IllegalArgumentException("adventuringDaysTarget must not be negative");
        }
        if (entranceCount < 0 || exitCount < 0) {
            throw new IllegalArgumentException("node counts must not be negative");
        }
    }

    public String displayName() {
        return "Ebene " + sortOrder;
    }
}
