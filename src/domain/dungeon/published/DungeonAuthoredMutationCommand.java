package src.domain.dungeon.published;

import org.jspecify.annotations.Nullable;

public sealed interface DungeonAuthoredMutationCommand permits
        DungeonAuthoredMutationCommand.PreviewOperation,
        DungeonAuthoredMutationCommand.ApplyOperation {

    final class PreviewOperation implements DungeonAuthoredMutationCommand {
        private final DungeonMapId mapId;
        private final @Nullable DungeonEditorOperation operation;

        public PreviewOperation(
                DungeonMapId mapId,
                @Nullable DungeonEditorOperation operation
        ) {
            this.mapId = mapId == null ? new DungeonMapId(1L) : mapId;
            this.operation = operation;
        }

        public DungeonMapId mapId() {
            return mapId;
        }

        public @Nullable DungeonEditorOperation operation() {
            return operation;
        }
    }

    record ApplyOperation(
            DungeonMapId mapId,
            @Nullable DungeonEditorOperation operation
    ) implements DungeonAuthoredMutationCommand {

        public ApplyOperation {
            mapId = mapId == null ? new DungeonMapId(1L) : mapId;
        }
    }
}
