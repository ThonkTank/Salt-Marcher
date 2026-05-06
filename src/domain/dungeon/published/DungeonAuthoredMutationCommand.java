package src.domain.dungeon.published;

public sealed interface DungeonAuthoredMutationCommand permits
        DungeonAuthoredMutationCommand.PreviewOperation,
        DungeonAuthoredMutationCommand.ApplyOperation {

    record PreviewOperation(
            DungeonMapId mapId,
            DungeonEditorOperation operation
    ) implements DungeonAuthoredMutationCommand {

        public PreviewOperation {
            mapId = mapId == null ? new DungeonMapId(1L) : mapId;
        }
    }

    record ApplyOperation(
            DungeonMapId mapId,
            DungeonEditorOperation operation
    ) implements DungeonAuthoredMutationCommand {

        public ApplyOperation {
            mapId = mapId == null ? new DungeonMapId(1L) : mapId;
        }
    }
}
