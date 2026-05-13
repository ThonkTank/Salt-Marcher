package src.domain.dungeon.application;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.map.model.DungeonMap;
import src.domain.dungeon.published.DungeonEditorOperation;

final class DungeonEditorOperationMutationUseCase {

    private DungeonEditorOperationMutationUseCase() {
    }

    static DungeonMap apply(DungeonMap current, @Nullable DungeonEditorOperation operation) {
        if (operation == null) {
            return current;
        }
        DungeonMap topologyMutation = DungeonEditorOperationTopologyMutationUseCase.apply(current, operation);
        if (topologyMutation != null) {
            return topologyMutation;
        }
        DungeonMap corridorMutation = DungeonEditorOperationCorridorMutationUseCase.apply(current, operation);
        if (corridorMutation != null) {
            return corridorMutation;
        }
        return DungeonEditorOperationNarrationMutationUseCase.apply(current, operation);
    }
}
