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
            src.domain.dungeon.model.runtime.repository.DungeonAuthoredPublishedStateRepository.MutationPublication result
    ) {
        return new src.domain.dungeon.published.DungeonAuthoredMutationResult.Operation(
                new src.domain.dungeon.published.DungeonOperationResult(
                        DungeonAuthoredReadProjectionServiceAssembly.snapshot(result.snapshot()),
                        result.validationMessages(),
                        result.reactionMessages()));
    }
}
