package src.domain.dungeon.published;

import org.jspecify.annotations.Nullable;

public sealed interface DungeonAuthoredMutationCommand permits
        DungeonAuthoredMutationCommand.Operation {

    record Operation(
            Action action,
            DungeonMapId mapId,
            @Nullable DungeonEditorOperation operation
    ) implements DungeonAuthoredMutationCommand {

        public Operation {
            action = action == null ? Action.APPLY : action;
            mapId = mapId == null ? new DungeonMapId(1L) : mapId;
        }
    }

    enum Action {
        PREVIEW,
        APPLY
    }
}
