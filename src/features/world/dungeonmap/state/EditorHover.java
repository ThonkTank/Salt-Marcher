package features.world.dungeonmap.state;

import features.world.dungeonmap.model.interaction.DungeonSelectionKey;

import java.util.Objects;

public record EditorHover(
        DungeonSelectionKey key,
        EditorHoverScope scope
) {
    public EditorHover {
        key = Objects.requireNonNull(key, "key");
        scope = Objects.requireNonNull(scope, "scope");
    }
}
