package src.domain.dungeon;

import java.util.List;

final class DungeonAuthoredMutationProjectionServiceAssembly {

    private DungeonAuthoredMutationProjectionServiceAssembly() {
    }

    static src.domain.dungeon.published.DungeonAuthoredMutationResult defaultMutation() {
        return new src.domain.dungeon.published.DungeonAuthoredMutationResult.Operation(
                new src.domain.dungeon.published.DungeonOperationResult(
                        DungeonPublishedMapProjectionServiceAssembly.defaultSnapshot(),
                        List.of(),
                        List.of()));
    }

    static src.domain.dungeon.published.DungeonAuthoredMutationResult mutation(
            DungeonAuthoredPublication.Mutation result
    ) {
        return new src.domain.dungeon.published.DungeonAuthoredMutationResult.Operation(
                new src.domain.dungeon.published.DungeonOperationResult(
                        DungeonAuthoredReadProjectionServiceAssembly.snapshot(result.snapshot()),
                        result.validationMessages(),
                        result.reactionMessages()));
    }
}
