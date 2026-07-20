package features.dungeon.api;

public sealed interface DungeonAuthoredMutationResult permits DungeonAuthoredMutationResult.Operation {

    record Operation(DungeonOperationResult result) implements DungeonAuthoredMutationResult { }
}
