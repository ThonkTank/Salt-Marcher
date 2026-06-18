package src.domain.dungeon.model.runtime.usecase;

import java.util.Objects;
import src.domain.dungeon.model.core.structure.DungeonMap;
import src.domain.dungeon.model.core.structure.DungeonMapIdentity;
import src.domain.dungeon.model.core.usecase.LoadDungeonMapUseCase;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.MapId;

public final class DeleteDungeonEditorAuthoredFeatureMarkerUseCase {
    private static final long NO_MARKER_ID = 0L;

    private final LoadDungeonMapUseCase loadDungeonMapUseCase;
    private final ApplyDungeonEditorOperationUseCase operationUseCase;
    private final PublishDungeonEditorAuthoredMutationUseCase publishMutationUseCase;

    public DeleteDungeonEditorAuthoredFeatureMarkerUseCase(
            LoadDungeonMapUseCase loadDungeonMapUseCase,
            ApplyDungeonEditorOperationUseCase operationUseCase,
            PublishDungeonEditorAuthoredMutationUseCase publishMutationUseCase
    ) {
        this.loadDungeonMapUseCase = Objects.requireNonNull(loadDungeonMapUseCase, "loadDungeonMapUseCase");
        this.operationUseCase = Objects.requireNonNull(operationUseCase, "operationUseCase");
        this.publishMutationUseCase = Objects.requireNonNull(publishMutationUseCase, "publishMutationUseCase");
    }

    public boolean execute(MapId mapId, long markerId) {
        if (mapId == null || markerId <= NO_MARKER_ID) {
            return false;
        }
        DungeonMapIdentity domainMapId = domainMapId(mapId);
        DungeonMap currentMap = loadDungeonMapUseCase.execute(domainMapId);
        if (currentMap == null || !currentMap.canDeleteFeatureMarker(markerId)) {
            return false;
        }
        ApplyDungeonEditorOperationUseCase.OperationResultData result = operationUseCase.execute(
                domainMapId,
                current -> current.deleteFeatureMarker(markerId));
        publishMutationUseCase.execute(result);
        return true;
    }

    private static DungeonMapIdentity domainMapId(MapId mapId) {
        return new DungeonMapIdentity(mapId.value());
    }
}
