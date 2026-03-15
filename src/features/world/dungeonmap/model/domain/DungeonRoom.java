package features.world.dungeonmap.model.domain;

public record DungeonRoom(
        Long roomId,
        Long mapId,
        String name,
        String lightLevel,
        String visualDescription,
        String soundsDescription,
        String smellsDescription,
        String otherDescription,
        String glanceDescription,
        String detailDescription,
        String reactiveChecks,
        String gmBackground,
        Long areaId,
        // Grid and concept mode are two views onto the same dungeon room model.
        // conceptLevelId only tells the concept canvas which level should render this room node.
        Long conceptLevelId
) {
    public DungeonRoom withMetadata(
            String updatedName,
            String updatedLightLevel,
            String updatedVisualDescription,
            String updatedSoundsDescription,
            String updatedSmellsDescription,
            String updatedOtherDescription,
            String updatedGlanceDescription,
            String updatedDetailDescription,
            String updatedReactiveChecks,
            String updatedGmBackground
    ) {
        return new DungeonRoom(
                roomId,
                mapId,
                updatedName,
                updatedLightLevel,
                updatedVisualDescription,
                updatedSoundsDescription,
                updatedSmellsDescription,
                updatedOtherDescription,
                updatedGlanceDescription,
                updatedDetailDescription,
                updatedReactiveChecks,
                updatedGmBackground,
                areaId,
                conceptLevelId);
    }

    public static DungeonRoom createDefault(Long mapId, String name) {
        return new DungeonRoom(null, mapId, name, "", "", "", "", "", "", "", "", "", null, null);
    }

    @Override
    public String toString() {
        return name;
    }
}
