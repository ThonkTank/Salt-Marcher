package src.domain.dungeon.application;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.map.model.DungeonMap;
import src.domain.dungeon.model.map.model.DungeonMapCorridorOps;
import src.domain.dungeon.published.DungeonEditorOperation;

final class DungeonEditorOperationCorridorMutationUseCase {

    private DungeonEditorOperationCorridorMutationUseCase() {
    }

    static @Nullable DungeonMap apply(DungeonMap current, DungeonEditorOperation operation) {
        if (operation instanceof DungeonEditorOperation.CreateCorridor create) {
            return DungeonMapCorridorOps.createCorridor(
                    current,
                    DungeonEditorOperationCorridorEndpointUseCase.endpoint(create.start()),
                    DungeonEditorOperationCorridorEndpointUseCase.endpoint(create.end()));
        }
        if (operation instanceof DungeonEditorOperation.ExtendCorridor extend) {
            return DungeonMapCorridorOps.extendCorridor(
                    current,
                    extend.corridorId(),
                    DungeonEditorOperationCorridorEndpointUseCase.roomEndpoint(extend.endpoint()));
        }
        if (operation instanceof DungeonEditorOperation.MergeCorridors merge) {
            return DungeonMapCorridorOps.mergeCorridors(current, merge.corridorId(), merge.mergedCorridorId());
        }
        if (operation instanceof DungeonEditorOperation.DeleteCorridor delete) {
            return DungeonMapCorridorOps.deleteCorridor(current, delete.corridorId());
        }
        return null;
    }
}
