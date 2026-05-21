package src.domain.dungeon.model.map.usecase;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.map.model.DungeonMapIdentity;
import src.domain.dungeon.model.map.model.DungeonTopologyElementKind;
import src.domain.dungeon.model.map.model.DungeonTopologyRef;
import src.domain.dungeon.model.map.repository.DungeonAuthoredPublishedStateRepository;

public final class RefreshDungeonAuthoredUseCase {

    private final LoadDungeonSnapshotUseCase loadDungeonSnapshotUseCase;
    private final @Nullable DungeonAuthoredPublishedStateRepository publishedStateRepository;

    public RefreshDungeonAuthoredUseCase(LoadDungeonSnapshotUseCase loadDungeonSnapshotUseCase) {
        this(loadDungeonSnapshotUseCase, null);
    }

    public RefreshDungeonAuthoredUseCase(
            LoadDungeonSnapshotUseCase loadDungeonSnapshotUseCase,
            @Nullable DungeonAuthoredPublishedStateRepository publishedStateRepository
    ) {
        this.loadDungeonSnapshotUseCase = Objects.requireNonNull(loadDungeonSnapshotUseCase, "loadDungeonSnapshotUseCase");
        this.publishedStateRepository = publishedStateRepository;
    }

    public void execute(ReadInput input) {
        ReadInput safeInput = input == null ? ReadInput.mapSelection(1L) : input;
        if (safeInput.action().describesSelection()) {
            publishInspector(describeSelection(
                    mapId(safeInput.mapIdValue()),
                    safeInput.topologyRef().toModelRef(),
                    safeInput.clusterId(),
                    safeInput.clusterSelection()));
            return;
        }
        publishSnapshot(refreshMap(mapId(safeInput.mapIdValue())));
    }

    public LoadDungeonSnapshotUseCase.DungeonSnapshotData refreshMap(@Nullable DungeonMapIdentity mapId) {
        return loadDungeonSnapshotUseCase.execute(mapId);
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

    private void publishSnapshot(LoadDungeonSnapshotUseCase.@Nullable DungeonSnapshotData snapshot) {
        if (publishedStateRepository != null && snapshot != null) {
            publishedStateRepository.publishSnapshot(new DungeonAuthoredPublishedStateRepository.SnapshotPublication(
                    snapshot.mapName(),
                    snapshot.derived(),
                    snapshot.editorHandles(),
                    snapshot.revision()));
        }
    }

    private void publishInspector(LoadDungeonSnapshotUseCase.@Nullable InspectorSnapshotData inspector) {
        if (publishedStateRepository != null && inspector != null) {
            publishedStateRepository.publishInspector(new DungeonAuthoredPublishedStateRepository.InspectorPublication(
                    inspector.title(),
                    inspector.description(),
                    inspector.facts(),
                    roomNarrations(inspector.roomNarrations())));
        }
    }

    private static List<DungeonAuthoredPublishedStateRepository.RoomNarrationPublication> roomNarrations(
            List<LoadDungeonSnapshotUseCase.RoomNarrationData> roomNarrations
    ) {
        List<DungeonAuthoredPublishedStateRepository.RoomNarrationPublication> result = new ArrayList<>();
        for (LoadDungeonSnapshotUseCase.RoomNarrationData roomNarration : roomNarrations) {
            result.add(new DungeonAuthoredPublishedStateRepository.RoomNarrationPublication(
                    roomNarration.roomId(),
                    roomNarration.roomName(),
                    roomNarration.visualDescription(),
                    roomExits(roomNarration.exits())));
        }
        return List.copyOf(result);
    }

    private static List<DungeonAuthoredPublishedStateRepository.RoomExitNarrationPublication> roomExits(
            List<LoadDungeonSnapshotUseCase.RoomExitNarrationData> exits
    ) {
        List<DungeonAuthoredPublishedStateRepository.RoomExitNarrationPublication> result = new ArrayList<>();
        for (LoadDungeonSnapshotUseCase.RoomExitNarrationData exit : exits) {
            result.add(new DungeonAuthoredPublishedStateRepository.RoomExitNarrationPublication(
                    exit.label(),
                    exit.cell(),
                    exit.direction(),
                    exit.description()));
        }
        return List.copyOf(result);
    }

    private static DungeonMapIdentity mapId(long mapIdValue) {
        return new DungeonMapIdentity(mapIdValue <= 0L ? 1L : mapIdValue);
    }

    public record ReadInput(
            ReadActionInput action,
            long mapIdValue,
            TopologyRefInput topologyRef,
            long clusterId,
            boolean clusterSelection
    ) {
        public ReadInput {
            action = action == null ? ReadActionInput.MAP_SELECTION : action;
            mapIdValue = mapIdValue <= 0L ? 1L : mapIdValue;
            topologyRef = topologyRef == null ? TopologyRefInput.empty() : topologyRef;
            clusterId = Math.max(0L, clusterId);
        }

        public static ReadInput mapSelection(long mapIdValue) {
            return new ReadInput(
                    ReadActionInput.MAP_SELECTION,
                    mapIdValue,
                    TopologyRefInput.empty(),
                    0L,
                    false);
        }
    }

    public record TopologyRefInput(String kindName, long id) {
        public TopologyRefInput {
            kindName = kindName == null || kindName.isBlank() ? "EMPTY" : kindName.trim();
            id = Math.max(0L, id);
        }

        public static TopologyRefInput empty() {
            return new TopologyRefInput("EMPTY", 0L);
        }

        DungeonTopologyRef toModelRef() {
            return new DungeonTopologyRef(DungeonTopologyElementKind.valueOf(kindName), id);
        }
    }

    public enum ReadActionInput {
        MAP_SELECTION,
        DESCRIBE_SELECTION;

        boolean describesSelection() {
            return this == DESCRIBE_SELECTION;
        }
    }
}
