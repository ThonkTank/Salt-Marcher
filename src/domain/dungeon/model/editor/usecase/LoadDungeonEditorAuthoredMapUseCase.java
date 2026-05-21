package src.domain.dungeon.model.editor.usecase;

import java.util.Objects;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorDungeonState;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.MapId;
import src.domain.dungeon.model.map.model.DungeonMapIdentity;
import src.domain.dungeon.model.map.model.DungeonTopologyRef;
import src.domain.dungeon.model.map.repository.DungeonAuthoredPublishedStateRepository;
import src.domain.dungeon.model.map.usecase.LoadDungeonSnapshotUseCase;
import src.domain.dungeon.model.map.usecase.RefreshDungeonAuthoredUseCase;

public final class LoadDungeonEditorAuthoredMapUseCase {

    private final RefreshDungeonAuthoredUseCase refreshUseCase;
    private final DungeonAuthoredPublishedStateRepository publishedStateRepository;
    private final DungeonEditorDungeonState state;
    private final DungeonEditorAuthoredOperationExchange exchange = new DungeonEditorAuthoredOperationExchange();

    public LoadDungeonEditorAuthoredMapUseCase(
            RefreshDungeonAuthoredUseCase refreshUseCase,
            DungeonAuthoredPublishedStateRepository publishedStateRepository,
            DungeonEditorDungeonState state
    ) {
        this.refreshUseCase = Objects.requireNonNull(refreshUseCase, "refreshUseCase");
        this.publishedStateRepository =
                Objects.requireNonNull(publishedStateRepository, "publishedStateRepository");
        this.state = Objects.requireNonNull(state, "state");
    }

    public LoadDungeonSnapshotUseCase.DungeonSnapshotData execute(MapId mapId) {
        LoadDungeonSnapshotUseCase.DungeonSnapshotData snapshot = refreshUseCase.refreshMap(domainMapId(mapId));
        publishSnapshot(snapshot);
        return snapshot;
    }

    public LoadDungeonSnapshotUseCase.AuthoredSurfaceData executeWithSelection(
            MapId mapId,
            DungeonTopologyRef topologyRef,
            long clusterId,
            boolean clusterSelection
    ) {
        LoadDungeonSnapshotUseCase.AuthoredSurfaceData surface = refreshUseCase.refreshMapAndDescribeSelection(
                domainMapId(mapId),
                topologyRef,
                clusterId,
                clusterSelection);
        publishSnapshot(surface.snapshot());
        return surface;
    }

    private void publishSnapshot(LoadDungeonSnapshotUseCase.DungeonSnapshotData snapshot) {
        state.replaceSnapshot(exchange.snapshotFacts(snapshot));
        publishedStateRepository.publishSnapshot(exchange.snapshotPublication(snapshot));
    }

    private static DungeonMapIdentity domainMapId(MapId mapId) {
        return new DungeonMapIdentity(mapId == null ? 1L : mapId.value());
    }
}
