package src.domain.dungeon.published;

public sealed interface DungeonAuthoredMutationResult permits DungeonAuthoredMutationResult.Operation {

    record Operation(DungeonOperationResult result) implements DungeonAuthoredMutationResult {

        public Operation {
            result = result == null ? new DungeonOperationResult(new DungeonSnapshot("", null, null, null, null, 0), null, null) : result;
        }
    }
}
