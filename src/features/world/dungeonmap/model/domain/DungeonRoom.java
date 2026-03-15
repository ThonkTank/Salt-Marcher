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
        Long areaId
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
                areaId);
    }

    public static DungeonRoom createDefault(Long mapId, String name) {
        return new DungeonRoom(null, mapId, name, "", "", "", "", "", "", "", "", "", null);
    }

    @Override
    public String toString() {
        return name;
    }
}
