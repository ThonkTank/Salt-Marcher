package features.world.dungeon.catalog.input;

public record RenameMapInput(
        long mapId,
        String name
) {
    public RenameMapInput {
        name = name == null ? "" : name.trim();
    }
}
