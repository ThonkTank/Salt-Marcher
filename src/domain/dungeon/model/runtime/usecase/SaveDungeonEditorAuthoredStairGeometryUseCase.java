package src.domain.dungeon.model.runtime.usecase;

import java.util.Objects;
import src.domain.dungeon.model.core.structure.DungeonMapIdentity;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.MapId;
import src.domain.dungeon.model.worldspace.usecase.ApplyDungeonEditorOperationUseCase;
import src.domain.dungeon.model.worldspace.usecase.LoadDungeonMapUseCase;
import src.domain.dungeon.model.worldspace.usecase.PublishDungeonEditorAuthoredMutationUseCase;

public final class SaveDungeonEditorAuthoredStairGeometryUseCase {
    private static final long NO_STAIR_ID = 0L;

    private final ApplyDungeonEditorOperationUseCase operationUseCase;
    private final LoadDungeonMapUseCase loadDungeonMapUseCase;
    private final PublishDungeonEditorAuthoredMutationUseCase publishMutationUseCase;

    public SaveDungeonEditorAuthoredStairGeometryUseCase(
            ApplyDungeonEditorOperationUseCase operationUseCase,
            LoadDungeonMapUseCase loadDungeonMapUseCase,
            PublishDungeonEditorAuthoredMutationUseCase publishMutationUseCase
    ) {
        this.operationUseCase = Objects.requireNonNull(operationUseCase, "operationUseCase");
        this.loadDungeonMapUseCase = Objects.requireNonNull(loadDungeonMapUseCase, "loadDungeonMapUseCase");
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
        ApplyDungeonEditorOperationUseCase.OperationResultData result = operationUseCase.execute(
                domainMapId(mapId),
                current -> current.saveStairGeometry(stairId, shapeName, directionName, dimension1, dimension2));
        publishMutationUseCase.execute(result);
    }

    public boolean canSave(
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
        return loadDungeonMapUseCase.execute(domainMapId(mapId)).canSaveStairGeometry(
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
