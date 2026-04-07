package features.world.dungeon.shell.editor.interaction;

import features.world.dungeon.model.interaction.DungeonSelectionRef;
import features.world.dungeon.state.EditorHover;

public record EditorHitResolution(
        DungeonSelectionRef hitRef,
        DungeonSelectionRef resolvedRef,
        EditorHover hover
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
