package src.domain.dungeon.model.worldspace.usecase;

import java.util.Objects;
import src.domain.dungeon.model.core.graph.DungeonTopologyRef;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.MapId;
import src.domain.dungeon.model.core.structure.DungeonMapIdentity;

public final class LoadDungeonEditorAuthoredMapUseCase {

    private final LoadDungeonSnapshotUseCase loadDungeonSnapshotUseCase;
    private final PublishDungeonEditorAuthoredSnapshotUseCase publishSnapshotUseCase;
    private final PublishDungeonEditorAuthoredInspectorUseCase publishInspectorUseCase;

    public LoadDungeonEditorAuthoredMapUseCase(
            LoadDungeonSnapshotUseCase loadDungeonSnapshotUseCase,
            PublishDungeonEditorAuthoredSnapshotUseCase publishSnapshotUseCase,
            PublishDungeonEditorAuthoredInspectorUseCase publishInspectorUseCase
    ) {
        this.loadDungeonSnapshotUseCase =
                Objects.requireNonNull(loadDungeonSnapshotUseCase, "loadDungeonSnapshotUseCase");
        this.publishSnapshotUseCase = Objects.requireNonNull(publishSnapshotUseCase, "publishSnapshotUseCase");
        this.publishInspectorUseCase = Objects.requireNonNull(publishInspectorUseCase, "publishInspectorUseCase");
    }

    public LoadDungeonSnapshotUseCase.DungeonSnapshotData execute(MapId mapId) {
        LoadDungeonSnapshotUseCase.DungeonSnapshotData snapshot =
                loadDungeonSnapshotUseCase.execute(domainMapId(mapId));
        publishSnapshotUseCase.execute(snapshot);
        return snapshot;
    }

    public LoadDungeonSnapshotUseCase.AuthoredSurfaceData executeWithSelection(
            MapId mapId,
            DungeonTopologyRef topologyRef,
            long clusterId,
            boolean clusterSelection
    ) {
        LoadDungeonSnapshotUseCase.AuthoredSurfaceData surface = loadDungeonSnapshotUseCase.executeWithSelection(
                domainMapId(mapId),
                topologyRef,
                clusterId,
                clusterSelection);
        publishSnapshotUseCase.execute(surface.snapshot());
        publishInspectorUseCase.execute(surface.inspector());
        return surface;
    }

    private static DungeonMapIdentity domainMapId(MapId mapId) {
        return new DungeonMapIdentity(mapId == null ? 1L : mapId.value());
    }
}
