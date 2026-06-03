package src.domain.dungeon.model.worldspace.usecase;

import java.util.Objects;
import src.domain.dungeon.model.worldspace.DungeonMapIdentity;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.MapId;

public final class SaveDungeonEditorAuthoredStairGeometryUseCase {
    private static final long NO_STAIR_ID = 0L;

    private final ApplyDungeonAuthoredMutationUseCase mutationUseCase;
    private final PublishDungeonEditorAuthoredMutationUseCase publishMutationUseCase;

    public SaveDungeonEditorAuthoredStairGeometryUseCase(
            ApplyDungeonAuthoredMutationUseCase mutationUseCase,
            PublishDungeonEditorAuthoredMutationUseCase publishMutationUseCase
    ) {
        this.mutationUseCase = Objects.requireNonNull(mutationUseCase, "mutationUseCase");
        this.publishMutationUseCase = Objects.requireNonNull(publishMutationUseCase, "publishMutationUseCase");
    }

    public void execute(
            MapId mapId,
            long stairId,
            String shapeName,
            String directionName,
            int dimension1,
            int dimension2
    ) {
        if (mapId == null || stairId <= NO_STAIR_ID || shapeName == null || shapeName.isBlank()
                || directionName == null || directionName.isBlank()
                || dimension1 <= 0 || dimension2 <= 0) {
            return;
        }
        ApplyDungeonEditorOperationUseCase.OperationResultData result = mutationUseCase.apply(
                domainMapId(mapId),
                current -> current.saveStairGeometry(stairId, shapeName, directionName, dimension1, dimension2));
        publishMutationUseCase.execute(result);
    }

    boolean canSave(
            MapId mapId,
            long stairId,
            String shapeName,
            String directionName,
            int dimension1,
            int dimension2
    ) {
        if (mapId == null || stairId <= NO_STAIR_ID || shapeName == null || shapeName.isBlank()
                || directionName == null || directionName.isBlank()
                || dimension1 <= 0 || dimension2 <= 0) {
            return false;
        }
        return mutationUseCase.canSaveStairGeometry(
                domainMapId(mapId),
                stairId,
                shapeName,
                directionName,
                dimension1,
                dimension2);
    }

    private static DungeonMapIdentity domainMapId(MapId mapId) {
        return new DungeonMapIdentity(mapId.value());
    }
}
