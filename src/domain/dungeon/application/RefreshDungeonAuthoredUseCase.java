package src.domain.dungeon.application;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.map.model.DungeonMapIdentity;
import src.domain.dungeon.model.map.model.DungeonTopologyRef;
import src.domain.dungeon.model.map.repository.DungeonPublishedStateRepository;

public final class RefreshDungeonAuthoredUseCase {

    private final LoadDungeonSnapshotUseCase loadDungeonSnapshotUseCase;
    private final DungeonPublishedStateRepository publishedStateRepository;

    public RefreshDungeonAuthoredUseCase(
            LoadDungeonSnapshotUseCase loadDungeonSnapshotUseCase,
            DungeonPublishedStateRepository publishedStateRepository
    ) {
        this.loadDungeonSnapshotUseCase = Objects.requireNonNull(loadDungeonSnapshotUseCase, "loadDungeonSnapshotUseCase");
        this.publishedStateRepository = Objects.requireNonNull(publishedStateRepository, "publishedStateRepository");
    }

    public void refreshMap(@Nullable DungeonMapIdentity mapId) {
        publishedStateRepository.publishAuthoredSnapshot(loadDungeonSnapshotUseCase.execute(mapId));
    }

    public void describeSelection(
            @Nullable DungeonMapIdentity mapId,
            DungeonTopologyRef topologyRef,
            long clusterId,
            boolean clusterSelection
    ) {
        publishedStateRepository.publishAuthoredInspector(loadDungeonSnapshotUseCase.describeSelection(
                mapId,
                topologyRef,
                clusterId,
                clusterSelection));
    }
}
