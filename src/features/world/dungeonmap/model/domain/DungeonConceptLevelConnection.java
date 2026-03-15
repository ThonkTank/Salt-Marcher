package features.world.dungeonmap.model.domain;

public record DungeonConceptLevelConnection(
        Long connectionId,
        Long mapId,
        Long levelAId,
        Long levelBId
) {
    // Each record is one concrete transition instance between two levels; parallel transitions are intentional.
    public DungeonConceptLevelConnection {
        if (mapId == null || mapId <= 0) {
            throw new IllegalArgumentException("mapId must be positive");
        }
        if (levelAId == null || levelAId <= 0 || levelBId == null || levelBId <= 0) {
            throw new IllegalArgumentException("Level ids must be positive");
        }
        if (levelAId.equals(levelBId)) {
            throw new IllegalArgumentException("Connections must link two different levels");
        }
    }

    public boolean connects(Long leftLevelId, Long rightLevelId) {
        return (levelAId.equals(leftLevelId) && levelBId.equals(rightLevelId))
                || (levelAId.equals(rightLevelId) && levelBId.equals(leftLevelId));
    }

    public Long otherLevelId(Long levelId) {
        if (levelAId.equals(levelId)) {
            return levelBId;
        }
        if (levelBId.equals(levelId)) {
            return levelAId;
        }
        return null;
    }
}
