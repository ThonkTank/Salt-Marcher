package src.domain.dungeon.published;

import java.util.List;

public record DungeonSurfaceMessages(
        List<String> validationMessages,
        List<String> reactionMessages
) {

    public DungeonSurfaceMessages {
        validationMessages = validationMessages == null ? List.of() : List.copyOf(validationMessages);
        reactionMessages = reactionMessages == null ? List.of() : List.copyOf(reactionMessages);
    }

    public static DungeonSurfaceMessages empty() {
        return new DungeonSurfaceMessages(List.of(), List.of());
    }
}
