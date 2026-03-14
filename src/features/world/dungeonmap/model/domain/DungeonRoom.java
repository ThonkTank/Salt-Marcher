package features.world.dungeonmap.model.domain;

public record DungeonRoom(
        Long roomId,
        Long mapId,
        String name,
        String glanceDescription,
        String detailDescription,
        String reactiveChecks,
        String gmBackground,
        Long areaId
) {
    public DungeonRoom withDetails(
            String updatedName,
            String updatedGlanceDescription,
            String updatedDetailDescription,
            String updatedReactiveChecks,
            String updatedGmBackground
    ) {
        return new DungeonRoom(
                roomId,
                mapId,
                updatedName,
                updatedGlanceDescription,
                updatedDetailDescription,
                updatedReactiveChecks,
                updatedGmBackground,
                areaId);
    }

    public static DungeonRoom createDefault(Long mapId, String name) {
        return new DungeonRoom(null, mapId, name, "", "", "", "", null);
    }

    @Override
    public String toString() {
        return name;
    }
}
