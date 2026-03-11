package features.world.dungeonmap.model;

public record DungeonRoom(
        Long roomId,
        Long mapId,
        String name,
        String description,
        Long areaId
) {
    @Override
    public String toString() {
        return name;
    }
}
