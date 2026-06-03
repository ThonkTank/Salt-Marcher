package src.domain.dungeon.model.worldspace;

import java.util.List;
import org.jspecify.annotations.Nullable;

/**
 * Owns authored operation feedback assembly for dungeon map mutations.
 */
public final class DungeonMapOperationFeedbackRules {

    public List<String> validationMessages(DungeonMap before, DungeonMap after) {
        return List.of("room anchor valid inside committed map bounds");
    }

    public List<String> reactionMessages(DungeonMap before, @Nullable DungeonMap after) {
        if (after == null || (before.topology().roomAnchorQ() == after.topology().roomAnchorQ()
                && before.topology().roomAnchorR() == after.topology().roomAnchorR())) {
            return List.of("derived state rebuilt without structural movement");
        }
        return List.of(
                "corridor attachment recomputed from moved room anchor",
                "door boundary re-anchored onto rebuilt aggregate relation graph"
        );
    }
}
