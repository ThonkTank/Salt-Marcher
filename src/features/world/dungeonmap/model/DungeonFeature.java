package features.world.dungeonmap.model;

public record DungeonFeature(
        Long featureId,
        Long mapId,
        DungeonFeatureCategory category,
        Long encounterId,
        String name,
        String notes
) {
    @Override
    public String toString() {
        return name == null || name.isBlank()
                ? ((category == null ? DungeonFeatureCategory.CURIOSITY : category).label())
                : name;
    }
}
