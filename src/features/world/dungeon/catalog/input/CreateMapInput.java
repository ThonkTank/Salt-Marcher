package features.world.dungeon.catalog.input;

public record CreateMapInput(
        String name
) {
    public CreateMapInput {
        name = name == null ? "" : name.trim();
    }
}
