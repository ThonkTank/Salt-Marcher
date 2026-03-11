package features.world.dungeonmap.model;

public record DungeonMap(Long mapId, String name, int width, int height) {
    public DungeonMap {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("name must not be blank");
        }
        if (width <= 0 || height <= 0) {
            throw new IllegalArgumentException("width and height must be > 0");
        }
    }
}
