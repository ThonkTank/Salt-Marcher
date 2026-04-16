package src.domain.dungeon.api;

import java.util.List;

/**
 * Mutation pipeline result surface.
 */
public record DungeonOperationResult(
        DungeonSnapshot snapshot,
        List<String> validationMessages,
        List<String> reactionMessages
) {

    public DungeonOperationResult {
        validationMessages = validationMessages == null ? List.of() : List.copyOf(validationMessages);
        reactionMessages = reactionMessages == null ? List.of() : List.copyOf(reactionMessages);
    }
}
