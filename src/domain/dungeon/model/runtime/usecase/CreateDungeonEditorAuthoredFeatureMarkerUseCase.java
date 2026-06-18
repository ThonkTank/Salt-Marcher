package src.domain.dungeon.model.runtime.usecase;

import java.util.Objects;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.structure.DungeonMap;
import src.domain.dungeon.model.core.structure.DungeonMapIdentity;
import src.domain.dungeon.model.core.structure.feature.FeatureMarkerKind;
import src.domain.dungeon.model.core.usecase.LoadDungeonMapUseCase;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.MapId;

public final class CreateDungeonEditorAuthoredFeatureMarkerUseCase {
    private static final String DEFAULT_LABEL = "";
    private static final String DEFAULT_DESCRIPTION = "";

    private final ApplyDungeonEditorOperationUseCase operationUseCase;
    private final LoadDungeonMapUseCase loadDungeonMapUseCase;
    private final PublishDungeonEditorAuthoredMutationUseCase publishMutationUseCase;

    public CreateDungeonEditorAuthoredFeatureMarkerUseCase(
            ApplyDungeonEditorOperationUseCase operationUseCase,
            LoadDungeonMapUseCase loadDungeonMapUseCase,
            PublishDungeonEditorAuthoredMutationUseCase publishMutationUseCase
    ) {
        this.operationUseCase = Objects.requireNonNull(operationUseCase, "operationUseCase");
        this.loadDungeonMapUseCase = Objects.requireNonNull(loadDungeonMapUseCase, "loadDungeonMapUseCase");
        this.publishMutationUseCase = Objects.requireNonNull(publishMutationUseCase, "publishMutationUseCase");
    }

    public long execute(MapId mapId, FeatureMarkerKind kind, Cell anchor) {
        Objects.requireNonNull(mapId, "mapId");
        Objects.requireNonNull(kind, "kind");
        Objects.requireNonNull(anchor, "anchor");
        DungeonMap currentMap = loadDungeonMapUseCase.execute(domainMapId(mapId));
        if (currentMap == null) {
            return 0L;
        }
        long markerId = currentMap.nextFeatureMarkerId();
        ApplyDungeonEditorOperationUseCase.OperationResultData result = operationUseCase.execute(
                domainMapId(mapId),
                current -> current.withFeatureMarkers(current.featureMarkers().withCreated(
                        markerId,
                        current.metadata().mapId(),
                        kind,
                        anchor,
                        DEFAULT_LABEL,
                        DEFAULT_DESCRIPTION)));
        publishMutationUseCase.execute(result);
        return markerId;
    }

    public boolean canExecute(MapId mapId, FeatureMarkerKind kind, Cell anchor) {
        return mapId != null
                && kind != null
                && anchor != null;
    }

    private static DungeonMapIdentity domainMapId(MapId mapId) {
        return new DungeonMapIdentity(mapId.value());
    }
}
