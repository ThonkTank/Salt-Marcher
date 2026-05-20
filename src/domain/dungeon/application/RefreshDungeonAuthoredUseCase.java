package src.domain.dungeon.application;

import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.map.helper.DungeonAuthoredPublishedProjectionHelper;
import src.domain.dungeon.model.map.helper.DungeonPublishedMapSnapshotProjectionHelper;
import src.domain.dungeon.model.map.model.DungeonMapIdentity;
import src.domain.dungeon.model.map.model.DungeonTopologyRef;
import src.domain.dungeon.model.map.repository.DungeonPublishedStateRepository;
import src.domain.dungeon.published.DungeonInspectorSnapshot;

public final class RefreshDungeonAuthoredUseCase {

    private final LoadDungeonSnapshotUseCase loadDungeonSnapshotUseCase;
    private final DungeonPublishedStateRepository publishedStateRepository;
    private final DungeonAuthoredPublishedProjectionHelper projectionHelper =
            new DungeonAuthoredPublishedProjectionHelper(new DungeonPublishedMapSnapshotProjectionHelper());

    public RefreshDungeonAuthoredUseCase(
            LoadDungeonSnapshotUseCase loadDungeonSnapshotUseCase,
            DungeonPublishedStateRepository publishedStateRepository
    ) {
        this.loadDungeonSnapshotUseCase = Objects.requireNonNull(loadDungeonSnapshotUseCase, "loadDungeonSnapshotUseCase");
        this.publishedStateRepository = Objects.requireNonNull(publishedStateRepository, "publishedStateRepository");
    }

    public void refreshMap(@Nullable DungeonMapIdentity mapId) {
        LoadDungeonSnapshotUseCase.DungeonSnapshotData snapshot = loadDungeonSnapshotUseCase.execute(mapId);
        publishedStateRepository.publishAuthoredSnapshot(projectionHelper.snapshot(
                snapshot.mapName(),
                snapshot.derived(),
                snapshot.editorHandles(),
                snapshot.revision()));
    }

    public void describeSelection(
            @Nullable DungeonMapIdentity mapId,
            DungeonTopologyRef topologyRef,
            long clusterId,
            boolean clusterSelection
    ) {
        LoadDungeonSnapshotUseCase.InspectorSnapshotData snapshot = loadDungeonSnapshotUseCase.describeSelection(
                mapId,
                topologyRef,
                clusterId,
                clusterSelection);
        publishedStateRepository.publishAuthoredInspector(projectionHelper.inspector(
                snapshot.title(),
                snapshot.description(),
                snapshot.facts(),
                roomNarrations(snapshot)));
    }

    private List<DungeonInspectorSnapshot.RoomNarrationCard> roomNarrations(
            LoadDungeonSnapshotUseCase.InspectorSnapshotData snapshot
    ) {
        return snapshot.roomNarrations().stream()
                .map(roomNarration -> projectionHelper.roomNarration(
                        roomNarration.roomId(),
                        roomNarration.roomName(),
                        roomNarration.visualDescription(),
                        roomNarration.exits().stream()
                                .map(exit -> projectionHelper.roomExit(
                                        exit.label(),
                                        exit.cell(),
                                        exit.direction(),
                                        exit.description()))
                                .toList()))
                .toList();
    }
}
