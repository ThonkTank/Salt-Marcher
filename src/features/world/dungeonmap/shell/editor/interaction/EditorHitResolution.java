package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.model.interaction.DungeonSelectionRef;
import features.world.dungeonmap.state.EditorHover;

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
