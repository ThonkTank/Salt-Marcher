package src.domain.dungeon.model.runtime.usecase;

import java.util.Objects;
import src.domain.dungeon.model.core.structure.DungeonMapIdentity;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.MapId;

public final class SaveDungeonEditorAuthoredLabelNameUseCase {
    private final ApplyDungeonAuthoredMutationUseCase mutationUseCase;
    private final PublishDungeonEditorAuthoredMutationUseCase publishMutationUseCase;

    public SaveDungeonEditorAuthoredLabelNameUseCase(
            ApplyDungeonAuthoredMutationUseCase mutationUseCase,
            PublishDungeonEditorAuthoredMutationUseCase publishMutationUseCase
    ) {
        this.mutationUseCase = Objects.requireNonNull(mutationUseCase, "mutationUseCase");
        this.publishMutationUseCase = Objects.requireNonNull(publishMutationUseCase, "publishMutationUseCase");
    }

    public void execute(MapId mapId, String targetKind, long targetId, String name) {
        if (targetId <= 0L || name == null || name.isBlank()) {
            return;
        }
        ApplyDungeonEditorOperationUseCase.OperationResultData result = mutationUseCase.applySaveLabelName(
                domainMapId(mapId),
                targetKind,
                targetId,
                name);
        publishMutationUseCase.execute(result);
    }

    private static DungeonMapIdentity domainMapId(MapId mapId) {
        return new DungeonMapIdentity(mapId == null ? 1L : mapId.value());
    }
}
