package src.domain.dungeon.model.editor.usecase;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorDungeonState;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.MapId;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.MapSnapshot;
import src.domain.dungeon.model.map.model.DungeonAreaFacts;
import src.domain.dungeon.model.map.model.DungeonBoundaryFacts;
import src.domain.dungeon.model.map.model.DungeonCell;
import src.domain.dungeon.model.map.model.DungeonDerivedState;
import src.domain.dungeon.model.map.model.DungeonEdge;
import src.domain.dungeon.model.map.model.DungeonEditorHandle;
import src.domain.dungeon.model.map.model.DungeonEditorHandleFacts;
import src.domain.dungeon.model.map.model.DungeonFeatureFacts;
import src.domain.dungeon.model.map.model.DungeonMapFacts;
import src.domain.dungeon.model.map.model.DungeonMapIdentity;
import src.domain.dungeon.model.map.model.DungeonTopology;
import src.domain.dungeon.model.map.model.DungeonTopologyRef;
import src.domain.dungeon.model.map.repository.DungeonAuthoredPublishedStateRepository;
import src.domain.dungeon.model.map.usecase.LoadDungeonSnapshotUseCase;

public final class LoadDungeonEditorAuthoredMapUseCase {

    private final LoadDungeonSnapshotUseCase loadDungeonSnapshotUseCase;
    private final DungeonAuthoredPublishedStateRepository publishedStateRepository;
    private final DungeonEditorDungeonState state;

    public LoadDungeonEditorAuthoredMapUseCase(
            LoadDungeonSnapshotUseCase loadDungeonSnapshotUseCase,
            DungeonAuthoredPublishedStateRepository publishedStateRepository,
            DungeonEditorDungeonState state
    ) {
        this.loadDungeonSnapshotUseCase =
                Objects.requireNonNull(loadDungeonSnapshotUseCase, "loadDungeonSnapshotUseCase");
        this.publishedStateRepository =
                Objects.requireNonNull(publishedStateRepository, "publishedStateRepository");
        this.state = Objects.requireNonNull(state, "state");
    }

    public LoadDungeonSnapshotUseCase.DungeonSnapshotData execute(MapId mapId) {
        LoadDungeonSnapshotUseCase.DungeonSnapshotData snapshot =
                loadDungeonSnapshotUseCase.execute(domainMapId(mapId));
        publishSnapshot(snapshot);
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
        publishSurface(surface);
        return surface;
    }

    private void publishSnapshot(LoadDungeonSnapshotUseCase.DungeonSnapshotData snapshot) {
        state.replaceSnapshot(snapshotFacts(snapshot));
        publishedStateRepository.publishSnapshot(snapshotPublication(snapshot));
    }

    private void publishSurface(LoadDungeonSnapshotUseCase.AuthoredSurfaceData surface) {
        publishSnapshot(surface.snapshot());
        publishInspector(surface.inspector());
    }

    private void publishInspector(LoadDungeonSnapshotUseCase.InspectorSnapshotData inspector) {
        state.replaceInspector(inspectorFacts(inspector));
        DungeonAuthoredPublishedStateRepository.InspectorPublication publication =
                inspectorPublication(inspector);
        if (publication != null) {
            publishedStateRepository.publishInspector(publication);
        }
    }

    private static DungeonMapIdentity domainMapId(MapId mapId) {
        return new DungeonMapIdentity(mapId == null ? 1L : mapId.value());
    }

    private static DungeonEditorDungeonState.@Nullable SnapshotFacts snapshotFacts(
            LoadDungeonSnapshotUseCase.@Nullable DungeonSnapshotData snapshot
    ) {
        if (snapshot == null) {
            return null;
        }
        return new DungeonEditorDungeonState.SnapshotFacts(
                snapshot.mapName(),
                revision(snapshot.revision()),
                mapSnapshot(snapshot.derived(), snapshot.editorHandles()));
    }

    private static DungeonAuthoredPublishedStateRepository.@Nullable SnapshotPublication snapshotPublication(
            LoadDungeonSnapshotUseCase.@Nullable DungeonSnapshotData snapshot
    ) {
        if (snapshot == null) {
            return null;
        }
        return new DungeonAuthoredPublishedStateRepository.SnapshotPublication(
                snapshot.mapName(),
                snapshot.derived(),
                snapshot.editorHandles(),
                snapshot.revision());
    }

    private static DungeonEditorWorkspaceValues.@Nullable Inspector inspectorFacts(
            LoadDungeonSnapshotUseCase.@Nullable InspectorSnapshotData inspector
    ) {
        if (inspector == null) {
            return null;
        }
        return new DungeonEditorWorkspaceValues.Inspector(
                inspector.title(),
                inspector.description(),
                inspector.facts(),
                roomNarrations(inspector.roomNarrations()));
    }

    private static DungeonAuthoredPublishedStateRepository.@Nullable InspectorPublication inspectorPublication(
            LoadDungeonSnapshotUseCase.@Nullable InspectorSnapshotData inspector
    ) {
        if (inspector == null) {
            return null;
        }
        return new DungeonAuthoredPublishedStateRepository.InspectorPublication(
                inspector.title(),
                inspector.description(),
                inspector.facts(),
                roomNarrationPublications(inspector.roomNarrations()));
    }

    private static int revision(long revision) {
        if (revision > Integer.MAX_VALUE) {
            return Integer.MAX_VALUE;
        }
        return Math.max(0, (int) revision);
    }

    private static MapSnapshot mapSnapshot(DungeonDerivedState derived, List<DungeonEditorHandleFacts> handles) {
        DungeonMapFacts safeFacts = derived == null || derived.map() == null
                ? new DungeonMapFacts(DungeonTopology.SQUARE, 1, 1, List.of(), List.of())
                : derived.map();
        List<DungeonEditorHandleFacts> safeHandles = handles == null ? List.of() : List.copyOf(handles);
        return new MapSnapshot(
                safeFacts.topology(),
                safeFacts.width(),
                safeFacts.height(),
                areas(safeFacts.areas()),
                boundaries(safeFacts.boundaries()),
                features(safeFacts.features()),
                handles(safeHandles));
    }

    private static DungeonEditorWorkspaceValues.Area area(DungeonAreaFacts area) {
        return new DungeonEditorWorkspaceValues.Area(
                area.kind(),
                area.id(),
                area.clusterId(),
                area.label(),
                cells(area.cells()),
                area.topologyRef());
    }

    private static DungeonEditorWorkspaceValues.Boundary boundary(DungeonBoundaryFacts boundary) {
        return new DungeonEditorWorkspaceValues.Boundary(
                DungeonEditorWorkspaceValues.BoundaryKind.fromExternalKind(boundary.kind()),
                boundary.id(),
                boundary.label(),
                edge(boundary.edge()),
                boundary.topologyRef());
    }

    private static DungeonEditorWorkspaceValues.Feature feature(DungeonFeatureFacts feature) {
        return new DungeonEditorWorkspaceValues.Feature(
                feature.kind(),
                feature.id(),
                feature.label(),
                cells(feature.cells()),
                feature.description(),
                feature.destinationLabel(),
                feature.topologyRef());
    }

    private static DungeonEditorWorkspaceValues.Handle handle(DungeonEditorHandleFacts handleFacts) {
        DungeonEditorHandle handle = handleFacts.handle();
        DungeonEditorWorkspaceValues.HandleRef ref = new DungeonEditorWorkspaceValues.HandleRef(
                handle.type(),
                handle.topologyRef(),
                handle.ownerId(),
                handle.clusterId(),
                handle.corridorId(),
                handle.roomId(),
                handle.index(),
                cell(handle.cell()),
                handle.direction().name());
        return new DungeonEditorWorkspaceValues.Handle(ref, handleFacts.label(), cell(handle.cell()));
    }

    private static List<DungeonEditorWorkspaceValues.Area> areas(List<DungeonAreaFacts> areas) {
        List<DungeonEditorWorkspaceValues.Area> result = new ArrayList<>();
        for (DungeonAreaFacts area : areas) {
            result.add(area(area));
        }
        return List.copyOf(result);
    }

    private static List<DungeonEditorWorkspaceValues.Boundary> boundaries(List<DungeonBoundaryFacts> boundaries) {
        List<DungeonEditorWorkspaceValues.Boundary> result = new ArrayList<>();
        for (DungeonBoundaryFacts boundary : boundaries) {
            result.add(boundary(boundary));
        }
        return List.copyOf(result);
    }

    private static List<DungeonEditorWorkspaceValues.Feature> features(List<DungeonFeatureFacts> features) {
        List<DungeonEditorWorkspaceValues.Feature> result = new ArrayList<>();
        for (DungeonFeatureFacts feature : features) {
            result.add(feature(feature));
        }
        return List.copyOf(result);
    }

    private static List<DungeonEditorWorkspaceValues.Handle> handles(List<DungeonEditorHandleFacts> handles) {
        List<DungeonEditorWorkspaceValues.Handle> result = new ArrayList<>();
        for (DungeonEditorHandleFacts handle : handles) {
            result.add(handle(handle));
        }
        return List.copyOf(result);
    }

    private static List<DungeonEditorWorkspaceValues.Cell> cells(List<DungeonCell> cells) {
        List<DungeonEditorWorkspaceValues.Cell> result = new ArrayList<>();
        for (DungeonCell cell : cells) {
            result.add(cell(cell));
        }
        return List.copyOf(result);
    }

    private static DungeonEditorWorkspaceValues.Edge edge(@Nullable DungeonEdge edge) {
        if (edge == null) {
            return new DungeonEditorWorkspaceValues.Edge(cell(null), cell(null));
        }
        return new DungeonEditorWorkspaceValues.Edge(cell(edge.from()), cell(edge.to()));
    }

    private static DungeonEditorWorkspaceValues.Cell cell(@Nullable DungeonCell cell) {
        return cell == null
                ? DungeonEditorWorkspaceValues.Cell.empty()
                : new DungeonEditorWorkspaceValues.Cell(cell.q(), cell.r(), cell.level());
    }

    private static List<DungeonAuthoredPublishedStateRepository.RoomNarrationPublication> roomNarrationPublications(
            List<LoadDungeonSnapshotUseCase.RoomNarrationData> roomNarrations
    ) {
        List<DungeonAuthoredPublishedStateRepository.RoomNarrationPublication> result = new ArrayList<>();
        for (LoadDungeonSnapshotUseCase.RoomNarrationData roomNarration : roomNarrations) {
            result.add(roomNarrationPublication(roomNarration));
        }
        return List.copyOf(result);
    }

    private static DungeonAuthoredPublishedStateRepository.RoomNarrationPublication roomNarrationPublication(
            LoadDungeonSnapshotUseCase.RoomNarrationData roomNarration
    ) {
        return new DungeonAuthoredPublishedStateRepository.RoomNarrationPublication(
                roomNarration.roomId(),
                roomNarration.roomName(),
                roomNarration.visualDescription(),
                roomExitPublications(roomNarration.exits()));
    }

    private static List<DungeonAuthoredPublishedStateRepository.RoomExitNarrationPublication> roomExitPublications(
            List<LoadDungeonSnapshotUseCase.RoomExitNarrationData> exits
    ) {
        List<DungeonAuthoredPublishedStateRepository.RoomExitNarrationPublication> result = new ArrayList<>();
        for (LoadDungeonSnapshotUseCase.RoomExitNarrationData exit : exits) {
            result.add(roomExitPublication(exit));
        }
        return List.copyOf(result);
    }

    private static DungeonAuthoredPublishedStateRepository.RoomExitNarrationPublication roomExitPublication(
            LoadDungeonSnapshotUseCase.RoomExitNarrationData exit
    ) {
        return new DungeonAuthoredPublishedStateRepository.RoomExitNarrationPublication(
                exit.label(),
                exit.cell(),
                exit.direction(),
                exit.description());
    }

    private static List<DungeonEditorWorkspaceValues.RoomNarrationCard> roomNarrations(
            List<LoadDungeonSnapshotUseCase.RoomNarrationData> roomNarrations
    ) {
        List<DungeonEditorWorkspaceValues.RoomNarrationCard> result = new ArrayList<>();
        for (LoadDungeonSnapshotUseCase.RoomNarrationData roomNarration : roomNarrations) {
            result.add(roomNarration(roomNarration));
        }
        return List.copyOf(result);
    }

    private static DungeonEditorWorkspaceValues.RoomNarrationCard roomNarration(
            LoadDungeonSnapshotUseCase.RoomNarrationData roomNarration
    ) {
        return new DungeonEditorWorkspaceValues.RoomNarrationCard(
                roomNarration.roomId(),
                roomNarration.roomName(),
                roomNarration.visualDescription(),
                roomExits(roomNarration.exits()));
    }

    private static List<DungeonEditorWorkspaceValues.RoomExitNarration> roomExits(
            List<LoadDungeonSnapshotUseCase.RoomExitNarrationData> exits
    ) {
        List<DungeonEditorWorkspaceValues.RoomExitNarration> result = new ArrayList<>();
        for (LoadDungeonSnapshotUseCase.RoomExitNarrationData exit : exits) {
            result.add(roomExit(exit));
        }
        return List.copyOf(result);
    }

    private static DungeonEditorWorkspaceValues.RoomExitNarration roomExit(
            LoadDungeonSnapshotUseCase.RoomExitNarrationData exit
    ) {
        return new DungeonEditorWorkspaceValues.RoomExitNarration(
                exit.label(),
                cell(exit.cell()),
                exit.direction().name(),
                exit.description());
    }
}
