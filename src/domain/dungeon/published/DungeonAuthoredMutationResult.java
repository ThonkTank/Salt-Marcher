package src.domain.dungeon.published;

public sealed interface DungeonAuthoredMutationResult permits DungeonAuthoredMutationResult.Operation {

    record Operation(DungeonOperationResult result) implements DungeonAuthoredMutationResult { }
}
