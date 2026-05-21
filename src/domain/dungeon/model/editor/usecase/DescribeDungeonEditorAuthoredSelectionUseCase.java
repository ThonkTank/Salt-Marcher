package src.domain.dungeon.model.editor.usecase;

import java.util.Objects;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.MapId;
import src.domain.dungeon.model.map.model.DungeonMapIdentity;
import src.domain.dungeon.model.map.model.DungeonTopologyRef;
import src.domain.dungeon.model.map.usecase.LoadDungeonSnapshotUseCase;
import src.domain.dungeon.model.map.usecase.RefreshDungeonAuthoredUseCase;

public final class DescribeDungeonEditorAuthoredSelectionUseCase {

    private final RefreshDungeonAuthoredUseCase refreshUseCase;
    private final PublishDungeonEditorAuthoredInspectorUseCase publishInspectorUseCase;

    public DescribeDungeonEditorAuthoredSelectionUseCase(
            RefreshDungeonAuthoredUseCase refreshUseCase,
            PublishDungeonEditorAuthoredInspectorUseCase publishInspectorUseCase
    ) {
        this.refreshUseCase = Objects.requireNonNull(refreshUseCase, "refreshUseCase");
        this.publishInspectorUseCase = Objects.requireNonNull(publishInspectorUseCase, "publishInspectorUseCase");
    }

    public void execute(
            MapId mapId,
            DungeonTopologyRef topologyRef,
            long clusterId,
            boolean clusterSelection
    ) {
        LoadDungeonSnapshotUseCase.InspectorSnapshotData inspector = refreshUseCase.describeSelection(
                domainMapId(mapId),
                topologyRef,
                clusterId,
                clusterSelection);
        publishInspectorUseCase.execute(inspector);
    }

    private static DungeonMapIdentity domainMapId(MapId mapId) {
        return new DungeonMapIdentity(mapId == null ? 1L : mapId.value());
    }
}
