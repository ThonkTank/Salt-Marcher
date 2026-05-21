package src.domain.dungeon.model.map.usecase;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.map.model.DungeonMapIdentity;
import src.domain.dungeon.model.map.model.DungeonTopologyRef;

public final class RefreshDungeonAuthoredUseCase {

    private final LoadDungeonSnapshotUseCase loadDungeonSnapshotUseCase;

    public RefreshDungeonAuthoredUseCase(LoadDungeonSnapshotUseCase loadDungeonSnapshotUseCase) {
        this.loadDungeonSnapshotUseCase = Objects.requireNonNull(loadDungeonSnapshotUseCase, "loadDungeonSnapshotUseCase");
    }

    public LoadDungeonSnapshotUseCase.DungeonSnapshotData refreshMap(@Nullable DungeonMapIdentity mapId) {
        return loadDungeonSnapshotUseCase.execute(mapId);
    }

    public LoadDungeonSnapshotUseCase.AuthoredSurfaceData refreshMapAndDescribeSelection(
            @Nullable DungeonMapIdentity mapId,
            DungeonTopologyRef topologyRef,
            long clusterId,
            boolean clusterSelection
    ) {
        return loadDungeonSnapshotUseCase.executeWithSelection(
                mapId,
                topologyRef,
                clusterId,
                clusterSelection);
    }

    public LoadDungeonSnapshotUseCase.InspectorSnapshotData describeSelection(
            @Nullable DungeonMapIdentity mapId,
            DungeonTopologyRef topologyRef,
            long clusterId,
            boolean clusterSelection
    ) {
        return loadDungeonSnapshotUseCase.describeSelection(
                mapId,
                topologyRef,
                clusterId,
                clusterSelection);
    }
}
