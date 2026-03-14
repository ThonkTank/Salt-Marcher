package features.world.dungeonmap.model.domain;

public record DungeonFeature(
        Long featureId,
        Long mapId,
        DungeonFeatureCategory category,
        Long encounterId,
        String name,
        String glanceDescription,
        String detailDescription,
        String reactiveChecks,
        String gmBackground,
        int sortOrder
) {
    public DungeonFeature withEncounterId(Long updatedEncounterId) {
        return new DungeonFeature(
                featureId,
                mapId,
                category,
                updatedEncounterId,
                name,
                glanceDescription,
                detailDescription,
                reactiveChecks,
                gmBackground,
                sortOrder);
    }

    public DungeonFeature withEditorValues(
            DungeonFeatureCategory updatedCategory,
            Long updatedEncounterId,
            String updatedName,
            String updatedGlanceDescription,
            String updatedDetailDescription,
            String updatedReactiveChecks,
            String updatedGmBackground,
            int updatedSortOrder
    ) {
        return new DungeonFeature(
                featureId,
                mapId,
                updatedCategory,
                updatedEncounterId,
                updatedName,
                updatedGlanceDescription,
                updatedDetailDescription,
                updatedReactiveChecks,
                updatedGmBackground,
                updatedSortOrder);
    }

    public static DungeonFeature create(Long mapId, DungeonFeatureCategory category, String name) {
        return new DungeonFeature(null, mapId, category, null, name, "", "", "", "", 0);
    }

    @Override
    public String toString() {
        return name == null || name.isBlank()
                ? ((category == null ? DungeonFeatureCategory.CURIOSITY : category).label())
                : name;
    }
}
