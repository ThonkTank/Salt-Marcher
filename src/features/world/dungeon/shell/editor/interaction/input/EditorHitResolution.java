package features.world.dungeon.shell.editor.interaction.input;

public record EditorHitResolution(
        features.world.dungeon.model.interaction.DungeonSelectionRef hitRef,
        features.world.dungeon.model.interaction.DungeonSelectionRef resolvedRef,
        features.world.dungeon.state.EditorHover hover
) {
    public EditorHitResolution {
        if (hover != null && hitRef == null) {
            throw new IllegalArgumentException("hover requires a hit ref");
        }
    }

    public static EditorHitResolution none() {
        return new EditorHitResolution(null, null, null);
    }
}
