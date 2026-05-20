package src.domain.dungeon.model.map.usecase;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.map.usecase.ApplyDungeonEditorOperationUseCase.Mutation;
import src.domain.dungeon.model.map.model.DungeonMapIdentity;

public final class ApplyDungeonAuthoredMutationUseCase {

    private final ApplyDungeonEditorOperationUseCase applyDungeonEditorOperationUseCase;

    public ApplyDungeonAuthoredMutationUseCase(ApplyDungeonEditorOperationUseCase applyDungeonEditorOperationUseCase) {
        this.applyDungeonEditorOperationUseCase =
                Objects.requireNonNull(applyDungeonEditorOperationUseCase, "applyDungeonEditorOperationUseCase");
    }

    public ApplyDungeonEditorOperationUseCase.OperationResultData apply(
            @Nullable DungeonMapIdentity mapId,
            @Nullable Mutation operation
    ) {
        return applyDungeonEditorOperationUseCase.execute(mapId, operation);
    }

    public ApplyDungeonEditorOperationUseCase.OperationResultData preview(
            @Nullable DungeonMapIdentity mapId,
            @Nullable Mutation operation
    ) {
        return applyDungeonEditorOperationUseCase.preview(mapId, operation);
    }
}
