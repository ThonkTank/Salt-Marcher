package features.world.dungeonmap.model.domain;

public record DungeonConnection(
        Long connectionId,
        Long mapId,
        Long conceptLevelId,
        String leftNodeKey,
        String rightNodeKey
) {
    public DungeonConnection {
        if (mapId == null || mapId <= 0) {
            throw new IllegalArgumentException("mapId must be positive");
        }
        if (conceptLevelId == null || conceptLevelId <= 0) {
            throw new IllegalArgumentException("conceptLevelId must be positive");
        }
        if (leftNodeKey == null || leftNodeKey.isBlank() || rightNodeKey == null || rightNodeKey.isBlank()) {
            throw new IllegalArgumentException("connection node keys must not be blank");
        }
        if (leftNodeKey.equals(rightNodeKey)) {
            throw new IllegalArgumentException("Connections must connect two different nodes");
        }
    }

    public static DungeonConnection ordered(
            Long connectionId,
            long mapId,
            long conceptLevelId,
            String firstNodeKey,
            String secondNodeKey
    ) {
        if (firstNodeKey == null || secondNodeKey == null) {
            throw new IllegalArgumentException("connection node keys must not be null");
        }
        return firstNodeKey.compareTo(secondNodeKey) <= 0
                ? new DungeonConnection(connectionId, mapId, conceptLevelId, firstNodeKey, secondNodeKey)
                : new DungeonConnection(connectionId, mapId, conceptLevelId, secondNodeKey, firstNodeKey);
    }

    public boolean connects(String firstNodeKey, String secondNodeKey) {
        return (leftNodeKey.equals(firstNodeKey) && rightNodeKey.equals(secondNodeKey))
                || (leftNodeKey.equals(secondNodeKey) && rightNodeKey.equals(firstNodeKey));
    }
}
