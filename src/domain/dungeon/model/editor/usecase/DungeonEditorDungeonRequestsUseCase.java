package src.domain.dungeon.model.editor.usecase;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorDungeonState;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorRoomNarrationInput;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionValues;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.MapId;
import src.domain.dungeon.model.editor.repository.DungeonEditorDungeonRepository;
import src.domain.dungeon.model.map.model.DungeonCell;
import src.domain.dungeon.model.map.model.DungeonClusterBoundaryKind;
import src.domain.dungeon.model.map.model.DungeonCorridorEndpoint;
import src.domain.dungeon.model.map.model.DungeonEdge;
import src.domain.dungeon.model.map.model.DungeonEdgeDirection;
import src.domain.dungeon.model.map.model.DungeonEditorHandle;
import src.domain.dungeon.model.map.model.DungeonEditorHandleType;
import src.domain.dungeon.model.map.model.DungeonMapIdentity;
import src.domain.dungeon.model.map.model.DungeonRoomExitDescription;
import src.domain.dungeon.model.map.model.DungeonRoomNarration;
import src.domain.dungeon.model.map.model.DungeonTopologyRef;
import src.domain.dungeon.model.map.repository.DungeonAuthoredPublishedStateRepository;
import src.domain.dungeon.model.map.usecase.ApplyDungeonAuthoredMutationUseCase;
import src.domain.dungeon.model.map.usecase.ApplyDungeonEditorOperationUseCase;
import src.domain.dungeon.model.map.usecase.ApplyDungeonMapCatalogUseCase;
import src.domain.dungeon.model.map.usecase.LoadDungeonSnapshotUseCase;
import src.domain.dungeon.model.map.usecase.RefreshDungeonAuthoredUseCase;
import src.domain.dungeon.model.map.usecase.SearchDungeonMapsUseCase;

public final class DungeonEditorDungeonRequestsUseCase implements
        DungeonEditorDungeonRepository.CatalogRequests,
        DungeonEditorDungeonRepository.AuthoredRequests {

    private final ApplyDungeonMapCatalogUseCase catalogUseCase;
    private final RefreshDungeonAuthoredUseCase refreshUseCase;
    private final ApplyDungeonAuthoredMutationUseCase mutationUseCase;
    private final DungeonAuthoredPublishedStateRepository publishedStateRepository;
    private final DungeonEditorDungeonState state;

    public DungeonEditorDungeonRequestsUseCase(
            ApplyDungeonMapCatalogUseCase catalogUseCase,
            RefreshDungeonAuthoredUseCase refreshUseCase,
            ApplyDungeonAuthoredMutationUseCase mutationUseCase,
            DungeonAuthoredPublishedStateRepository publishedStateRepository,
            DungeonEditorDungeonState state
    ) {
        this.catalogUseCase = Objects.requireNonNull(catalogUseCase, "catalogUseCase");
        this.refreshUseCase = Objects.requireNonNull(refreshUseCase, "refreshUseCase");
        this.mutationUseCase = Objects.requireNonNull(mutationUseCase, "mutationUseCase");
        this.publishedStateRepository =
                Objects.requireNonNull(publishedStateRepository, "publishedStateRepository");
        this.state = Objects.requireNonNull(state, "state");
    }

    @Override
    public void searchMaps(String query) {
        DungeonAuthoredPublishedStateRepository.CatalogPublication catalog =
                catalogPublication(catalogUseCase.search(query));
        state.replaceCatalog(catalog);
        publishedStateRepository.publishSearch(catalog);
    }

    @Override
    public void createMap(String mapName) {
        DungeonMapIdentity mapId = catalogUseCase.createMap(mapName);
        state.replaceMutationMapId(mapId);
        publishedStateRepository.publishCreated(mapId);
    }

    @Override
    public void renameMap(MapId mapId, String mapName) {
        DungeonMapIdentity mutationMapId = catalogUseCase.renameMap(domainMapId(mapId), mapName);
        state.replaceMutationMapId(mutationMapId);
        publishedStateRepository.publishRenamed(mutationMapId);
    }

    @Override
    public void deleteMap(MapId mapId) {
        DungeonMapIdentity mutationMapId = catalogUseCase.deleteMap(domainMapId(mapId));
        state.replaceMutationMapId(mutationMapId);
        publishedStateRepository.publishDeleted(mutationMapId);
    }

    @Override
    public void loadMap(MapId mapId) {
        DungeonAuthoredPublishedStateRepository.SnapshotPublication snapshot =
                snapshotPublication(refreshUseCase.refreshMap(domainMapId(mapId)));
        state.replaceSnapshot(snapshot);
        publishedStateRepository.publishSnapshot(snapshot);
    }

    @Override
    public void describeSelection(
            MapId mapId,
            DungeonTopologyRef topologyRef,
            long clusterId,
            boolean clusterSelection
    ) {
        DungeonAuthoredPublishedStateRepository.InspectorPublication inspector =
                inspectorPublication(refreshUseCase.describeSelection(
                domainMapId(mapId),
                topologyRef,
                clusterId,
                clusterSelection));
        state.replaceInspector(inspector);
        publishedStateRepository.publishInspector(inspector);
    }

    @Override
    public void previewOperation(MapId mapId, DungeonEditorSessionValues.Preview preview) {
        ApplyDungeonEditorOperationUseCase.Mutation mutation = mutation(preview);
        if (mutation != null) {
            DungeonAuthoredPublishedStateRepository.MutationPublication mutationPublication =
                    mutationPublication(mutationUseCase.preview(
                    domainMapId(mapId),
                    mutation));
            state.replaceMutation(mutationPublication);
            publishedStateRepository.publishMutation(mutationPublication);
        }
    }

    @Override
    public void applyOperation(MapId mapId, DungeonEditorSessionValues.Preview preview) {
        ApplyDungeonEditorOperationUseCase.Mutation mutation = mutation(preview);
        if (mutation != null) {
            DungeonAuthoredPublishedStateRepository.MutationPublication mutationPublication =
                    mutationPublication(mutationUseCase.apply(
                    domainMapId(mapId),
                    mutation));
            state.replaceMutation(mutationPublication);
            publishedStateRepository.publishMutation(mutationPublication);
        }
    }

    @Override
    public void saveRoomNarration(MapId mapId, DungeonEditorRoomNarrationInput roomNarration) {
        DungeonAuthoredPublishedStateRepository.MutationPublication mutationPublication =
                mutationPublication(mutationUseCase.apply(
                domainMapId(mapId),
                current -> current.saveRoomNarration(
                        roomNarration.roomId(),
                        roomNarration(roomNarration))));
        state.replaceMutation(mutationPublication);
        publishedStateRepository.publishMutation(mutationPublication);
    }

    private static ApplyDungeonEditorOperationUseCase.@Nullable Mutation mutation(
            DungeonEditorSessionValues.Preview preview
    ) {
        if (preview == null || preview == DungeonEditorSessionValues.Preview.none()) {
            return null;
        }
        if (preview instanceof DungeonEditorSessionValues.RoomRectanglePreview room) {
            return room.deleteMode()
                    ? current -> current.deleteRoomRectangle(cell(room.start()), cell(room.end()))
                    : current -> current.paintRoomRectangle(cell(room.start()), cell(room.end()));
        }
        if (preview instanceof DungeonEditorSessionValues.ClusterBoundariesPreview boundaries) {
            return current -> current.editClusterBoundaries(
                    boundaries.clusterId(),
                    edges(boundaries.edges()),
                    boundaryKind(boundaries.boundaryKind()),
                    boundaries.deleteMode());
        }
        if (preview instanceof DungeonEditorSessionValues.CorridorCreatePreview corridor) {
            return current -> current.createCorridor(
                    corridorEndpoint(corridor.start()),
                    corridorEndpoint(corridor.end()));
        }
        if (preview instanceof DungeonEditorSessionValues.DeleteCorridorPreview corridorDelete) {
            return current -> current.deleteCorridor(corridorDelete.corridorId());
        }
        if (preview instanceof DungeonEditorSessionValues.MoveHandlePreview moveHandle) {
            return current -> current.moveEditorHandle(
                    handle(moveHandle.handleRef()),
                    moveHandle.deltaQ(),
                    moveHandle.deltaR(),
                    moveHandle.deltaLevel());
        }
        if (preview instanceof DungeonEditorSessionValues.MoveBoundaryStretchPreview stretch) {
            return current -> current.moveBoundaryStretch(
                    stretch.clusterId(),
                    edges(stretch.sourceEdges()),
                    stretch.deltaQ(),
                    stretch.deltaR(),
                    stretch.deltaLevel());
        }
        return null;
    }

    private static DungeonMapIdentity domainMapId(MapId mapId) {
        return new DungeonMapIdentity(mapId == null ? 1L : mapId.value());
    }

    private static DungeonCell cell(DungeonEditorWorkspaceValues.Cell cell) {
        DungeonEditorWorkspaceValues.Cell safeCell = cell == null
                ? DungeonEditorWorkspaceValues.Cell.empty()
                : cell;
        return new DungeonCell(safeCell.q(), safeCell.r(), safeCell.level());
    }

    private static DungeonEdge edge(DungeonEditorWorkspaceValues.Edge edge) {
        if (edge == null) {
            DungeonCell origin = cell(null);
            return new DungeonEdge(origin, origin);
        }
        return new DungeonEdge(cell(edge.from()), cell(edge.to()));
    }

    private static List<DungeonEdge> edges(List<DungeonEditorWorkspaceValues.Edge> edges) {
        if (edges == null) {
            return List.of();
        }
        List<DungeonEdge> result = new ArrayList<>();
        for (DungeonEditorWorkspaceValues.Edge edge : edges) {
            result.add(edge(edge));
        }
        return List.copyOf(result);
    }

    private static DungeonClusterBoundaryKind boundaryKind(DungeonEditorWorkspaceValues.BoundaryKind boundaryKind) {
        return boundaryKind != null && boundaryKind.isDoor()
                ? DungeonClusterBoundaryKind.DOOR
                : DungeonClusterBoundaryKind.WALL;
    }

    private static DungeonEditorHandle handle(DungeonEditorWorkspaceValues.HandleRef ref) {
        DungeonEditorWorkspaceValues.HandleRef safeRef = ref == null
                ? DungeonEditorWorkspaceValues.HandleRef.empty()
                : ref;
        return new DungeonEditorHandle(
                safeRef.kind() == null ? DungeonEditorHandleType.CLUSTER_LABEL : safeRef.kind(),
                safeRef.topologyRef(),
                safeRef.ownerId(),
                safeRef.clusterId(),
                safeRef.corridorId(),
                safeRef.roomId(),
                safeRef.index(),
                cell(safeRef.cell()),
                direction(safeRef.direction()));
    }

    private static DungeonCorridorEndpoint corridorEndpoint(DungeonEditorWorkspaceValues.CorridorEndpoint endpoint) {
        return switch (endpoint) {
            case DungeonEditorWorkspaceValues.CorridorDoorEndpoint door -> DungeonCorridorEndpoint.door(
                    door.roomId(),
                    door.clusterId(),
                    cell(door.roomCell()),
                    direction(door.direction()),
                    door.topologyRef());
            case DungeonEditorWorkspaceValues.CorridorAnchorEndpoint anchor -> DungeonCorridorEndpoint.anchor(
                    anchor.hostCorridorId(),
                    cell(anchor.anchorCell()),
                    anchor.topologyRef());
            case null -> DungeonCorridorEndpoint.door(
                    0L,
                    0L,
                    cell(null),
                    DungeonEdgeDirection.NORTH,
                    DungeonTopologyRef.empty());
        };
    }

    private static DungeonRoomNarration roomNarration(DungeonEditorRoomNarrationInput roomNarration) {
        return new DungeonRoomNarration(
                roomNarration.visualDescription(),
                roomExits(roomNarration.exits()));
    }

    private static List<DungeonRoomExitDescription> roomExits(
            List<DungeonEditorWorkspaceValues.RoomExitNarration> exits
    ) {
        List<DungeonRoomExitDescription> result = new ArrayList<>();
        for (DungeonEditorWorkspaceValues.RoomExitNarration exit : exits) {
            result.add(roomExit(exit));
        }
        return List.copyOf(result);
    }

    private static DungeonRoomExitDescription roomExit(DungeonEditorWorkspaceValues.RoomExitNarration exit) {
        DungeonEditorWorkspaceValues.RoomExitNarration safeExit = exit == null
                ? new DungeonEditorWorkspaceValues.RoomExitNarration(
                        "",
                        DungeonEditorWorkspaceValues.Cell.empty(),
                        "",
                        "")
                : exit;
        return new DungeonRoomExitDescription(
                cell(safeExit.cell()),
                direction(safeExit.direction()),
                safeExit.description());
    }

    private static DungeonEdgeDirection direction(String direction) {
        return direction == null || direction.isBlank()
                ? DungeonEdgeDirection.NORTH
                : DungeonEdgeDirection.parse(direction);
    }

    private static DungeonAuthoredPublishedStateRepository.CatalogPublication catalogPublication(
            ApplyDungeonMapCatalogUseCase.MapCatalogResult result
    ) {
        return new DungeonAuthoredPublishedStateRepository.CatalogPublication(result == null
                ? List.of()
                : mapSummaryPublications(result.maps()));
    }

    private static List<DungeonAuthoredPublishedStateRepository.MapSummaryPublication> mapSummaryPublications(
            List<SearchDungeonMapsUseCase.MapSummary> mapSummaries
    ) {
        List<DungeonAuthoredPublishedStateRepository.MapSummaryPublication> result = new ArrayList<>();
        for (SearchDungeonMapsUseCase.MapSummary mapSummary : mapSummaries) {
            result.add(mapSummaryPublication(mapSummary));
        }
        return List.copyOf(result);
    }

    private static DungeonAuthoredPublishedStateRepository.MapSummaryPublication mapSummaryPublication(
            SearchDungeonMapsUseCase.MapSummary mapSummary
    ) {
        return new DungeonAuthoredPublishedStateRepository.MapSummaryPublication(
                mapSummary.mapId(),
                mapSummary.mapName(),
                mapSummary.revision());
    }

    private static DungeonAuthoredPublishedStateRepository.SnapshotPublication snapshotPublication(
            LoadDungeonSnapshotUseCase.DungeonSnapshotData snapshot
    ) {
        return snapshot == null
                ? null
                : new DungeonAuthoredPublishedStateRepository.SnapshotPublication(
                        snapshot.mapName(),
                        snapshot.derived(),
                        snapshot.editorHandles(),
                        snapshot.revision());
    }

    private static DungeonAuthoredPublishedStateRepository.InspectorPublication inspectorPublication(
            LoadDungeonSnapshotUseCase.InspectorSnapshotData inspector
    ) {
        return inspector == null
                ? null
                : new DungeonAuthoredPublishedStateRepository.InspectorPublication(
                        inspector.title(),
                        inspector.description(),
                        inspector.facts(),
                        roomNarrationPublications(inspector.roomNarrations()));
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
                roomExitNarrationPublications(roomNarration.exits()));
    }

    private static List<DungeonAuthoredPublishedStateRepository.RoomExitNarrationPublication>
            roomExitNarrationPublications(List<LoadDungeonSnapshotUseCase.RoomExitNarrationData> exits) {
        List<DungeonAuthoredPublishedStateRepository.RoomExitNarrationPublication> result = new ArrayList<>();
        for (LoadDungeonSnapshotUseCase.RoomExitNarrationData exit : exits) {
            result.add(roomExitNarrationPublication(exit));
        }
        return List.copyOf(result);
    }

    private static DungeonAuthoredPublishedStateRepository.RoomExitNarrationPublication roomExitNarrationPublication(
            LoadDungeonSnapshotUseCase.RoomExitNarrationData exit
    ) {
        return new DungeonAuthoredPublishedStateRepository.RoomExitNarrationPublication(
                exit.label(),
                exit.cell(),
                exit.direction(),
                exit.description());
    }

    private static DungeonAuthoredPublishedStateRepository.MutationPublication mutationPublication(
            ApplyDungeonEditorOperationUseCase.OperationResultData mutation
    ) {
        return mutation == null
                ? null
                : new DungeonAuthoredPublishedStateRepository.MutationPublication(
                        snapshotPublication(mutation.snapshot()),
                        mutation.validationMessages(),
                        mutation.reactionMessages());
    }

}
