package features.world.dungeonmap.state;

import features.world.dungeonmap.model.interaction.DungeonSelectionRef;

import java.util.Objects;

public record EditorHover(
        DungeonSelectionRef ref,
        EditorHoverScope scope
) {
    public EditorHover {
        ref = Objects.requireNonNull(ref, "ref");
        scope = Objects.requireNonNull(scope, "scope");
    }
}
