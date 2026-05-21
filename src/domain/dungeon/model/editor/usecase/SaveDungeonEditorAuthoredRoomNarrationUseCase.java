package src.domain.dungeon.model.editor.usecase;

import java.util.Objects;
import src.domain.dungeon.model.editor.helper.DungeonEditorAuthoredOperationHelper;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorDungeonState;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorRoomNarrationInput;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.MapId;
import src.domain.dungeon.model.map.model.DungeonMapIdentity;
import src.domain.dungeon.model.map.repository.DungeonAuthoredPublishedStateRepository;
import src.domain.dungeon.model.map.usecase.ApplyDungeonAuthoredMutationUseCase;
import src.domain.dungeon.model.map.usecase.ApplyDungeonEditorOperationUseCase;

public final class SaveDungeonEditorAuthoredRoomNarrationUseCase {

    private final ApplyDungeonAuthoredMutationUseCase mutationUseCase;
    private final PublishDungeonEditorAuthoredMutationUseCase publishMutationUseCase;

    public SaveDungeonEditorAuthoredRoomNarrationUseCase(
            ApplyDungeonAuthoredMutationUseCase mutationUseCase,
            DungeonAuthoredPublishedStateRepository publishedStateRepository,
            DungeonEditorDungeonState state
    ) {
        this.mutationUseCase = Objects.requireNonNull(mutationUseCase, "mutationUseCase");
        this.publishMutationUseCase = new PublishDungeonEditorAuthoredMutationUseCase(
                publishedStateRepository,
                state);
    }

    public void execute(MapId mapId, DungeonEditorRoomNarrationInput roomNarration) {
        if (roomNarration == null || !DungeonEditorWorkspaceValues.hasId(roomNarration.roomId())) {
            return;
        }
        ApplyDungeonEditorOperationUseCase.OperationResultData result = mutationUseCase.apply(
                domainMapId(mapId),
                current -> current.saveRoomNarration(
                        roomNarration.roomId(),
                        DungeonEditorAuthoredOperationHelper.roomNarration(roomNarration)));
        publishMutationUseCase.execute(result);
    }

    private static DungeonMapIdentity domainMapId(MapId mapId) {
        return new DungeonMapIdentity(mapId == null ? 1L : mapId.value());
    }
}
