package features.world.dungeonmap.model;

public record DungeonArea(
        Long areaId,
        Long mapId,
        String name,
        String description,
        Long encounterTableId
) {
    @Override
    public String toString() {
        return name;
    }
}
