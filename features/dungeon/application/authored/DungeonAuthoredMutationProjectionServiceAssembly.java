package features.dungeon.application.authored;

import java.util.List;

final class DungeonAuthoredMutationProjectionServiceAssembly {

    private DungeonAuthoredMutationProjectionServiceAssembly() {
    }

    static features.dungeon.api.DungeonAuthoredMutationResult defaultMutation() {
        return new features.dungeon.api.DungeonAuthoredMutationResult.Operation(
                new features.dungeon.api.DungeonOperationResult(
                        DungeonPublishedMapProjectionServiceAssembly.defaultSnapshot(),
                        List.of(),
                        List.of()));
    }

    static features.dungeon.api.DungeonAuthoredMutationResult mutation(
            DungeonAuthoredPublication.Mutation result
    ) {
        return new features.dungeon.api.DungeonAuthoredMutationResult.Operation(
                new features.dungeon.api.DungeonOperationResult(
                        DungeonAuthoredReadProjectionServiceAssembly.snapshot(result.snapshot()),
                        result.validationMessages(),
                        result.reactionMessages()));
    }
}
