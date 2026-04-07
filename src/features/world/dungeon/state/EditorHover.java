package features.world.dungeon.state;

import features.world.dungeon.model.interaction.DungeonSelectionRef;

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
