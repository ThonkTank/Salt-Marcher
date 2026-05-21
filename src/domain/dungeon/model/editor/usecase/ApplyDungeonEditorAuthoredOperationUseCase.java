package src.domain.dungeon.model.editor.usecase;

import java.util.Objects;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionValues;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.MapId;
import src.domain.dungeon.model.map.model.DungeonMapIdentity;
import src.domain.dungeon.model.map.usecase.ApplyDungeonAuthoredMutationUseCase;
import src.domain.dungeon.model.map.usecase.ApplyDungeonEditorOperationUseCase;

public final class ApplyDungeonEditorAuthoredOperationUseCase {

    private final ApplyDungeonAuthoredMutationUseCase mutationUseCase;
    private final TranslateDungeonEditorAuthoredPreviewUseCase translatePreviewUseCase;
    private final PublishDungeonEditorAuthoredMutationUseCase publishMutationUseCase;

    public ApplyDungeonEditorAuthoredOperationUseCase(
            ApplyDungeonAuthoredMutationUseCase mutationUseCase,
            TranslateDungeonEditorAuthoredPreviewUseCase translatePreviewUseCase,
            PublishDungeonEditorAuthoredMutationUseCase publishMutationUseCase
    ) {
        this.mutationUseCase = Objects.requireNonNull(mutationUseCase, "mutationUseCase");
        this.translatePreviewUseCase = Objects.requireNonNull(translatePreviewUseCase, "translatePreviewUseCase");
        this.publishMutationUseCase = Objects.requireNonNull(publishMutationUseCase, "publishMutationUseCase");
    }

    public void execute(MapId mapId, DungeonEditorSessionValues.Preview preview) {
        ApplyDungeonEditorOperationUseCase.Mutation mutation = translatePreviewUseCase.execute(preview);
        if (mutation == null) {
            return;
        }
        ApplyDungeonEditorOperationUseCase.OperationResultData result = mutationUseCase.apply(
                domainMapId(mapId),
                mutation);
        publishMutationUseCase.execute(result);
    }

    private static DungeonMapIdentity domainMapId(MapId mapId) {
        return new DungeonMapIdentity(mapId == null ? 1L : mapId.value());
    }
}
