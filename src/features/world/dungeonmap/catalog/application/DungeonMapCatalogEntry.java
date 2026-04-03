package features.world.dungeonmap.catalog.application;

public record DungeonMapCatalogEntry(
        long mapId,
        String name
) {
    public DungeonMapCatalogEntry {
        name = name == null || name.isBlank() ? "Dungeon " + mapId : name;
    }
}
