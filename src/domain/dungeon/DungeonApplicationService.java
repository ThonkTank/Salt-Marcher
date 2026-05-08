package src.domain.dungeon;

import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.application.ApplyDungeonEditorOperationUseCase;
import src.domain.dungeon.application.AssembleDungeonSnapshotUseCase;
import src.domain.dungeon.application.BuildDungeonDerivedStateUseCase;
import src.domain.dungeon.application.CreateDungeonMapUseCase;
import src.domain.dungeon.application.DeleteDungeonMapUseCase;
import src.domain.dungeon.application.InspectDungeonSelectionUseCase;
import src.domain.dungeon.application.LoadDungeonMapUseCase;
import src.domain.dungeon.application.LoadDungeonSnapshotUseCase;
import src.domain.dungeon.application.LoadDungeonTravelSurfaceUseCase;
import src.domain.dungeon.application.MoveDungeonTravelActionUseCase;
import src.domain.dungeon.application.PublishDungeonEditorHandlesUseCase;
import src.domain.dungeon.application.RenameDungeonMapUseCase;
import src.domain.dungeon.application.SearchDungeonMapsUseCase;
import src.domain.dungeon.map.entity.DungeonAggregate;
import src.domain.dungeon.map.port.DungeonMapRepository;
import src.domain.dungeon.map.port.DungeonMapSearch;
import src.domain.dungeon.map.value.DungeonAreaFacts;
import src.domain.dungeon.map.value.DungeonAreaType;
import src.domain.dungeon.map.value.DungeonBoundaryFacts;
import src.domain.dungeon.map.value.DungeonCell;
import src.domain.dungeon.map.value.DungeonClusterBoundaryKind;
import src.domain.dungeon.map.value.DungeonCorridorAnchorEndpoint;
import src.domain.dungeon.map.value.DungeonCorridorDoorEndpoint;
import src.domain.dungeon.map.value.DungeonCorridorEndpoint;
import src.domain.dungeon.map.value.DungeonCorridorRoomEndpoint;
import src.domain.dungeon.map.value.DungeonEditorHandle;
import src.domain.dungeon.map.value.DungeonEditorHandleFacts;
import src.domain.dungeon.map.value.DungeonEditorHandleType;
import src.domain.dungeon.map.value.DungeonEdge;
import src.domain.dungeon.map.value.DungeonEdgeDirection;
import src.domain.dungeon.map.value.DungeonFeatureFacts;
import src.domain.dungeon.map.value.DungeonMapFacts;
import src.domain.dungeon.map.value.DungeonMapIdentity;
import src.domain.dungeon.map.value.DungeonRoomExitDescription;
import src.domain.dungeon.map.value.DungeonRoomNarration;
import src.domain.dungeon.map.value.DungeonTopology;
import src.domain.dungeon.map.value.DungeonTopologyElementKind;
import src.domain.dungeon.map.value.DungeonTopologyRef;
import src.domain.dungeon.map.value.DungeonTravelActionFacts;
import src.domain.dungeon.map.value.DungeonTravelExternalTargetFacts;
import src.domain.dungeon.map.value.DungeonTravelHeading;
import src.domain.dungeon.map.value.DungeonTravelLocationKind;
import src.domain.dungeon.map.value.DungeonTravelMoveFacts;
import src.domain.dungeon.map.value.DungeonTravelPositionFacts;
import src.domain.dungeon.map.value.DungeonTravelSurfaceFacts;
import src.domain.dungeon.published.DungeonAreaKind;
import src.domain.dungeon.published.DungeonAreaSnapshot;
import src.domain.dungeon.published.DungeonAuthoredMutationCommand;
import src.domain.dungeon.published.DungeonAuthoredMutationResult;
import src.domain.dungeon.published.DungeonAuthoredReadCommand;
import src.domain.dungeon.published.DungeonAuthoredReadResult;
import src.domain.dungeon.published.DungeonBoundaryKind;
import src.domain.dungeon.published.DungeonBoundarySnapshot;
import src.domain.dungeon.published.DungeonCellRef;
import src.domain.dungeon.published.DungeonEdgeRef;
import src.domain.dungeon.published.DungeonEditorHandleKind;
import src.domain.dungeon.published.DungeonEditorHandleRef;
import src.domain.dungeon.published.DungeonEditorHandleSnapshot;
import src.domain.dungeon.published.DungeonEditorOperation;
import src.domain.dungeon.published.DungeonFeatureKind;
import src.domain.dungeon.published.DungeonFeatureSnapshot;
import src.domain.dungeon.published.DungeonInspectorSnapshot;
import src.domain.dungeon.published.DungeonMapCatalogCommand;
import src.domain.dungeon.published.DungeonMapCatalogResponse;
import src.domain.dungeon.published.DungeonMapId;
import src.domain.dungeon.published.DungeonMapMode;
import src.domain.dungeon.published.DungeonMapSnapshot;
import src.domain.dungeon.published.DungeonMapSummary;
import src.domain.dungeon.published.DungeonOperationResult;
import src.domain.dungeon.published.DungeonSnapshot;
import src.domain.dungeon.published.DungeonTopologyElementRef;
import src.domain.dungeon.published.DungeonTopologyKind;
import src.domain.dungeon.published.DungeonTravelActionKind;
import src.domain.dungeon.published.DungeonTravelActionSnapshot;
import src.domain.dungeon.published.DungeonTravelCommand;
import src.domain.dungeon.published.DungeonTravelContextKind;
import src.domain.dungeon.published.DungeonTravelExternalTarget;
import src.domain.dungeon.published.DungeonTravelMoveResult;
import src.domain.dungeon.published.DungeonTravelMoveStatus;
import src.domain.dungeon.published.DungeonTravelPosition;
import src.domain.dungeon.published.DungeonTravelResponse;
import src.domain.dungeon.published.DungeonTravelSurfaceSnapshot;

/**
 * Public dungeon feature facade used by editor and travel interactors.
 */
public final class DungeonApplicationService {

    private final DungeonPublishedStatePublisher publishedStatePublisher;
    private final LoadDungeonSnapshotUseCase loadDungeonSnapshotUseCase;
    private final ApplyDungeonEditorOperationUseCase applyDungeonEditorOperationUseCase;
    private final SearchDungeonMapsUseCase searchDungeonMapsUseCase;
    private final CreateDungeonMapUseCase createDungeonMapUseCase;
    private final RenameDungeonMapUseCase renameDungeonMapUseCase;
    private final DeleteDungeonMapUseCase deleteDungeonMapUseCase;
    private final LoadDungeonTravelSurfaceUseCase loadDungeonTravelSurfaceUseCase;
    private final MoveDungeonTravelActionUseCase moveDungeonTravelActionUseCase;

    public DungeonApplicationService(
            DungeonMapRepository mapRepository,
            DungeonMapSearch mapSearch,
            DungeonPublishedStatePublisher publishedStatePublisher
    ) {
        DungeonMapRepository repository = Objects.requireNonNull(mapRepository, "mapRepository");
        DungeonMapSearch search = Objects.requireNonNull(mapSearch, "mapSearch");
        this.publishedStatePublisher = Objects.requireNonNull(publishedStatePublisher, "publishedStatePublisher");
        BuildDungeonDerivedStateUseCase derive = new BuildDungeonDerivedStateUseCase();
        LoadDungeonMapUseCase loadDungeonMapUseCase = new LoadDungeonMapUseCase(repository, search);
        PublishDungeonEditorHandlesUseCase publishDungeonEditorHandlesUseCase = new PublishDungeonEditorHandlesUseCase();
        AssembleDungeonSnapshotUseCase assembleDungeonSnapshotUseCase = new AssembleDungeonSnapshotUseCase(derive);
        InspectDungeonSelectionUseCase inspectDungeonSelectionUseCase = new InspectDungeonSelectionUseCase(derive);
        this.loadDungeonSnapshotUseCase = new LoadDungeonSnapshotUseCase(
                loadDungeonMapUseCase,
                assembleDungeonSnapshotUseCase,
                publishDungeonEditorHandlesUseCase,
                inspectDungeonSelectionUseCase);
        this.applyDungeonEditorOperationUseCase = new ApplyDungeonEditorOperationUseCase(
                loadDungeonMapUseCase,
                repository::save,
                derive::execute,
                assembleDungeonSnapshotUseCase,
                publishDungeonEditorHandlesUseCase);
        this.searchDungeonMapsUseCase = new SearchDungeonMapsUseCase(search);
        this.createDungeonMapUseCase = new CreateDungeonMapUseCase(repository::nextMapId, repository::save);
        this.renameDungeonMapUseCase = new RenameDungeonMapUseCase(repository::findById, repository::save);
        this.deleteDungeonMapUseCase = new DeleteDungeonMapUseCase(repository::delete);
        this.loadDungeonTravelSurfaceUseCase = new LoadDungeonTravelSurfaceUseCase(loadDungeonMapUseCase, derive);
        this.moveDungeonTravelActionUseCase = new MoveDungeonTravelActionUseCase(
                loadDungeonMapUseCase,
                repository::findById,
                derive::execute);
    }

    public void refreshAuthored(DungeonAuthoredReadCommand command) {
        DungeonAuthoredReadCommand effectiveCommand = Objects.requireNonNull(command, "command");
        DungeonAuthoredReadResult result;
        if (effectiveCommand instanceof DungeonAuthoredReadCommand.LoadSnapshot loadSnapshot) {
            result = new DungeonAuthoredReadResult.CommittedSnapshot(toPublishedCommittedSnapshot(
                    loadDungeonSnapshotUseCase.execute(domainId(loadSnapshot.mapId()))));
        } else {
            DungeonAuthoredReadCommand.DescribeSelection describeSelection =
                    (DungeonAuthoredReadCommand.DescribeSelection) effectiveCommand;
            result = new DungeonAuthoredReadResult.SelectionInspector(toPublishedSelectionInspector(
                    loadDungeonSnapshotUseCase.describeSelection(
                            domainId(describeSelection.mapId()),
                            domainTopologyRef(describeSelection.topologyRef()),
                            describeSelection.clusterId(),
                            describeSelection.clusterSelection())));
        }
        publishedStatePublisher.publishAuthoredRead(result);
    }

    public void mutateAuthored(DungeonAuthoredMutationCommand command) {
        DungeonAuthoredMutationCommand effectiveCommand = Objects.requireNonNull(command, "command");
        ApplyDungeonEditorOperationUseCase.OperationResultData result;
        if (effectiveCommand instanceof DungeonAuthoredMutationCommand.PreviewOperation previewOperation) {
            result = applyDungeonEditorOperationUseCase.preview(
                    domainId(previewOperation.mapId()),
                    operationMutation(previewOperation.operation()));
        } else {
            DungeonAuthoredMutationCommand.ApplyOperation applyOperation =
                    (DungeonAuthoredMutationCommand.ApplyOperation) effectiveCommand;
            result = applyDungeonEditorOperationUseCase.execute(
                    domainId(applyOperation.mapId()),
                    operationMutation(applyOperation.operation()));
        }
        publishedStatePublisher.publishAuthoredMutation(
                new DungeonAuthoredMutationResult.Operation(toPublishedOperationResult(result)));
    }

    public void catalog(DungeonMapCatalogCommand command) {
        DungeonMapCatalogCommand effectiveCommand = Objects.requireNonNull(command, "command");
        DungeonMapCatalogResponse response;
        if (effectiveCommand instanceof DungeonMapCatalogCommand.Search search) {
            response = new DungeonMapCatalogResponse.MapList(
                    searchDungeonMapsUseCase.execute(search.query()).stream()
                            .map(this::toPublishedSummary)
                            .toList());
        } else if (effectiveCommand instanceof DungeonMapCatalogCommand.CreateMap createMap) {
            response = new DungeonMapCatalogResponse.MapMutation(
                    DungeonMapCatalogResponse.MutationKind.CREATED,
                    id(createDungeonMapUseCase.execute(createMap.mapName()).mapId()));
        } else if (effectiveCommand instanceof DungeonMapCatalogCommand.RenameMap renameMap) {
            response = new DungeonMapCatalogResponse.MapMutation(
                    DungeonMapCatalogResponse.MutationKind.RENAMED,
                    id(renameDungeonMapUseCase.execute(
                            domainId(renameMap.mapId()),
                            renameMap.mapName()).mapId()));
        } else {
            DungeonMapCatalogCommand.DeleteMap deleteMap = (DungeonMapCatalogCommand.DeleteMap) effectiveCommand;
            response = new DungeonMapCatalogResponse.MapMutation(
                    DungeonMapCatalogResponse.MutationKind.DELETED,
                    id(deleteDungeonMapUseCase.execute(domainId(deleteMap.mapId()))));
        }
        publishedStatePublisher.publishMapCatalog(response);
    }

    public void travel(DungeonTravelCommand command) {
        DungeonTravelCommand effectiveCommand = Objects.requireNonNull(command, "command");
        DungeonTravelResponse response;
        if (effectiveCommand instanceof DungeonTravelCommand.LoadSurface loadSurface) {
            response = new DungeonTravelResponse.Surface(toPublishedTravelSurface(
                    loadDungeonTravelSurfaceUseCase.execute(new LoadDungeonTravelSurfaceUseCase.Input(
                            domainTravelPosition(loadSurface.position())))));
        } else {
            DungeonTravelCommand.MoveAction moveAction = (DungeonTravelCommand.MoveAction) effectiveCommand;
            response = new DungeonTravelResponse.Move(toPublishedTravelMoveResult(
                    moveDungeonTravelActionUseCase.execute(new MoveDungeonTravelActionUseCase.Input(
                            domainTravelPosition(moveAction.position()),
                            moveAction.actionId()))));
        }
        publishedStatePublisher.publishTravel(response);
    }

    private DungeonSnapshot toPublishedCommittedSnapshot(LoadDungeonSnapshotUseCase.DungeonSnapshotData snapshot) {
        return new DungeonSnapshot(
                snapshot.mapName(),
                DungeonMapMode.EDITOR,
                toPublishedMapSnapshot(snapshot.derived().map(), snapshot.editorHandles()),
                snapshot.derived().aggregates().stream().map(this::aggregateSummary).toList(),
                snapshot.derived().relations().summaries(),
                revision(snapshot.revision()));
    }

    private DungeonInspectorSnapshot toPublishedSelectionInspector(
            LoadDungeonSnapshotUseCase.InspectorSnapshotData snapshot
    ) {
        return new DungeonInspectorSnapshot(
                snapshot.title(),
                snapshot.description(),
                snapshot.facts(),
                snapshot.roomNarrations().stream()
                        .map(roomNarration -> new DungeonInspectorSnapshot.RoomNarrationCard(
                                roomNarration.roomId(),
                                roomNarration.roomName(),
                                roomNarration.visualDescription(),
                                roomNarration.exits().stream()
                                        .map(exit -> new DungeonInspectorSnapshot.RoomExitNarration(
                                                exit.label(),
                                                cell(exit.cell()),
                                                exit.direction().name(),
                                                exit.description()))
                                        .toList()))
                        .toList());
    }

    private DungeonOperationResult toPublishedOperationResult(ApplyDungeonEditorOperationUseCase.OperationResultData result) {
        return new DungeonOperationResult(
                toPublishedCommittedSnapshot(result.snapshot()),
                result.validationMessages(),
                result.reactionMessages());
    }

    private DungeonMapSnapshot toPublishedMapSnapshot(DungeonMapFacts facts, List<DungeonEditorHandleFacts> handles) {
        DungeonMapFacts safeFacts = facts == null
                ? new DungeonMapFacts(DungeonTopology.SQUARE, 1, 1, List.of(), List.of())
                : facts;
        List<DungeonEditorHandleFacts> safeHandles = handles == null ? List.of() : List.copyOf(handles);
        return new DungeonMapSnapshot(
                safeFacts.topology() == DungeonTopology.HEX ? DungeonTopologyKind.HEX : DungeonTopologyKind.SQUARE,
                safeFacts.width(),
                safeFacts.height(),
                safeFacts.areas().stream().map(this::toPublishedArea).toList(),
                safeFacts.boundaries().stream().map(this::toPublishedBoundary).toList(),
                safeFacts.features().stream().map(this::toPublishedFeature).toList(),
                safeHandles.stream().map(this::toPublishedHandle).toList());
    }

    private DungeonMapSnapshot toPublishedMapSnapshot(DungeonMapFacts facts) {
        return toPublishedMapSnapshot(facts, List.of());
    }

    private DungeonAreaSnapshot toPublishedArea(DungeonAreaFacts area) {
        return new DungeonAreaSnapshot(
                area.kind() == DungeonAreaType.CORRIDOR ? DungeonAreaKind.CORRIDOR : DungeonAreaKind.ROOM,
                area.id(),
                area.clusterId(),
                area.label(),
                area.cells().stream().map(this::cell).toList(),
                topologyRef(area.topologyRef()));
    }

    private DungeonBoundarySnapshot toPublishedBoundary(DungeonBoundaryFacts boundary) {
        return new DungeonBoundarySnapshot(
                boundary.kind(),
                boundary.id(),
                boundary.label(),
                edge(boundary.edge()),
                topologyRef(boundary.topologyRef()));
    }

    private DungeonFeatureSnapshot toPublishedFeature(DungeonFeatureFacts feature) {
        return new DungeonFeatureSnapshot(
                DungeonFeatureKind.valueOf(feature.kind().name()),
                feature.id(),
                feature.label(),
                feature.cells().stream().map(this::cell).toList(),
                feature.description(),
                feature.destinationLabel(),
                topologyRef(feature.topologyRef()));
    }

    private DungeonEditorHandleSnapshot toPublishedHandle(DungeonEditorHandleFacts handle) {
        return new DungeonEditorHandleSnapshot(
                toPublishedHandleRef(handle.handle()),
                handle.label(),
                cell(handle.handle().cell()));
    }

    private DungeonTravelSurfaceSnapshot toPublishedTravelSurface(DungeonTravelSurfaceFacts surface) {
        return new DungeonTravelSurfaceSnapshot(
                DungeonTravelContextKind.DUNGEON,
                surface.mapName(),
                revision(surface.revision()),
                toPublishedMapSnapshot(surface.map()),
                toPublishedTravelPosition(surface.position()),
                surface.surfaceTitle(),
                surface.areaLabel(),
                surface.tileLabel(),
                surface.headingLabel(),
                surface.statusLabel(),
                surface.visualDescription(),
                surface.actions().stream().map(this::toPublishedTravelAction).toList());
    }

    private DungeonTravelMoveResult toPublishedTravelMoveResult(DungeonTravelMoveFacts result) {
        return new DungeonTravelMoveResult(
                DungeonTravelMoveStatus.valueOf(result.status().name()),
                result.message(),
                toPublishedTravelSurface(result.surface()),
                toPublishedTravelExternalTarget(result.externalTarget()));
    }

    private @Nullable DungeonTravelExternalTarget toPublishedTravelExternalTarget(
            @Nullable DungeonTravelExternalTargetFacts externalTarget
    ) {
        if (externalTarget instanceof DungeonTravelExternalTargetFacts.OverworldTile overworld) {
            return new DungeonTravelExternalTarget.OverworldTile(overworld.mapId(), overworld.tileId());
        }
        return null;
    }

    private DungeonTravelActionSnapshot toPublishedTravelAction(DungeonTravelActionFacts action) {
        return new DungeonTravelActionSnapshot(
                action.actionId(),
                DungeonTravelActionKind.valueOf(action.kind().name()),
                action.label(),
                action.destinationLabel(),
                action.description());
    }

    private DungeonTravelPosition toPublishedTravelPosition(DungeonTravelPositionFacts position) {
        return new DungeonTravelPosition(
                id(position.mapId()),
                src.domain.dungeon.published.DungeonTravelLocationKind.valueOf(position.locationKind().name()),
                position.ownerId(),
                cell(position.tile()),
                src.domain.dungeon.published.DungeonTravelHeading.valueOf(position.heading().name()));
    }

    private @Nullable DungeonTravelPositionFacts domainTravelPosition(@Nullable DungeonTravelPosition position) {
        if (position == null) {
            return null;
        }
        return new DungeonTravelPositionFacts(
                domainId(position.mapId()),
                DungeonTravelLocationKind.valueOf(position.locationKind().name()),
                position.ownerId(),
                domainCell(position.tile()),
                DungeonTravelHeading.valueOf(position.heading().name()));
    }

    private DungeonMapSummary toPublishedSummary(SearchDungeonMapsUseCase.MapSummary summary) {
        return new DungeonMapSummary(id(summary.mapId()), summary.mapName(), summary.revision());
    }

    private ApplyDungeonEditorOperationUseCase.OperationMutation operationMutation(
            @Nullable DungeonEditorOperation operation
    ) {
        return switch (operation) {
            case null -> ApplyDungeonEditorOperationUseCase.OperationMutation.identity();
            case DungeonEditorOperation.MoveTopologyElement moveTopologyElement -> {
                DungeonTopologyRef ref = domainTopologyRef(moveTopologyElement.ref());
                yield current -> current.moveTopologyElement(
                        ref,
                        moveTopologyElement.deltaQ(),
                        moveTopologyElement.deltaR(),
                        moveTopologyElement.deltaLevel());
            }
            case DungeonEditorOperation.MoveEditorHandle moveEditorHandle -> {
                DungeonEditorHandle handle = domainHandle(moveEditorHandle.ref());
                yield current -> current.moveEditorHandle(
                        handle,
                        moveEditorHandle.deltaQ(),
                        moveEditorHandle.deltaR(),
                        moveEditorHandle.deltaLevel());
            }
            case DungeonEditorOperation.MoveBoundaryStretch moveBoundaryStretch -> {
                List<DungeonEdge> sourceEdges = moveBoundaryStretch.sourceEdges().stream().map(this::domainEdge).toList();
                yield current -> current.moveBoundaryStretch(
                        moveBoundaryStretch.clusterId(),
                        sourceEdges,
                        moveBoundaryStretch.deltaQ(),
                        moveBoundaryStretch.deltaR(),
                        moveBoundaryStretch.deltaLevel());
            }
            case DungeonEditorOperation.MoveRoomAnchor moveRoomAnchor ->
                    current -> current.moveRoomAnchor(moveRoomAnchor.deltaQ(), moveRoomAnchor.deltaR());
            case DungeonEditorOperation.PaintRoomRectangle paintRoomRectangle -> {
                DungeonCell start = domainCell(paintRoomRectangle.start());
                DungeonCell end = domainCell(paintRoomRectangle.end());
                yield current -> current.paintRoomRectangle(start, end);
            }
            case DungeonEditorOperation.DeleteRoomRectangle deleteRoomRectangle -> {
                DungeonCell start = domainCell(deleteRoomRectangle.start());
                DungeonCell end = domainCell(deleteRoomRectangle.end());
                yield current -> current.deleteRoomRectangle(start, end);
            }
            case DungeonEditorOperation.EditClusterBoundaries editClusterBoundaries -> {
                List<DungeonEdge> edges = editClusterBoundaries.edges().stream().map(this::domainEdge).toList();
                DungeonClusterBoundaryKind kind = editClusterBoundaries.kind() == DungeonBoundaryKind.DOOR
                        ? DungeonClusterBoundaryKind.DOOR
                        : DungeonClusterBoundaryKind.WALL;
                yield current -> current.editClusterBoundaries(
                        editClusterBoundaries.clusterId(),
                        edges,
                        kind,
                        editClusterBoundaries.deleteBoundary());
            }
            case DungeonEditorOperation.CreateCorridor createCorridor -> {
                DungeonCorridorEndpoint start = domainCorridorEndpoint(createCorridor.start());
                DungeonCorridorEndpoint end = domainCorridorEndpoint(createCorridor.end());
                yield current -> current.createCorridor(start, end);
            }
            case DungeonEditorOperation.ExtendCorridor extendCorridor -> {
                DungeonCorridorRoomEndpoint endpoint = domainCorridorRoomEndpoint(extendCorridor.endpoint());
                yield current -> current.extendCorridor(extendCorridor.corridorId(), endpoint);
            }
            case DungeonEditorOperation.MergeCorridors mergeCorridors ->
                    current -> current.mergeCorridors(mergeCorridors.corridorId(), mergeCorridors.mergedCorridorId());
            case DungeonEditorOperation.DeleteCorridor deleteCorridor ->
                    current -> current.deleteCorridor(deleteCorridor.corridorId());
            case DungeonEditorOperation.SaveRoomNarration saveRoomNarration -> {
                DungeonRoomNarration narration = new DungeonRoomNarration(
                        saveRoomNarration.visualDescription(),
                        saveRoomNarration.exits().stream().map(this::domainExitNarration).toList());
                yield current -> current.saveRoomNarration(saveRoomNarration.roomId(), narration);
            }
        };
    }

    private DungeonCorridorEndpoint domainCorridorEndpoint(DungeonEditorOperation.CorridorEndpoint endpoint) {
        return switch (endpoint) {
            case DungeonEditorOperation.CorridorDoorEndpoint doorEndpoint -> new DungeonCorridorDoorEndpoint(
                    doorEndpoint.roomId(),
                    doorEndpoint.clusterId(),
                    domainCell(doorEndpoint.roomCell()),
                    direction(doorEndpoint.direction()),
                    domainTopologyRef(doorEndpoint.topologyRef()));
            case DungeonEditorOperation.CorridorAnchorEndpoint anchorEndpoint -> new DungeonCorridorAnchorEndpoint(
                    anchorEndpoint.hostCorridorId(),
                    domainCell(anchorEndpoint.anchorCell()),
                    domainTopologyRef(anchorEndpoint.topologyRef()));
            case null -> new DungeonCorridorDoorEndpoint(
                    0L,
                    0L,
                    emptyCell(),
                    DungeonEdgeDirection.NORTH,
                    DungeonTopologyRef.empty());
        };
    }

    private DungeonCorridorRoomEndpoint domainCorridorRoomEndpoint(
            DungeonEditorOperation.@Nullable CorridorRoomEndpoint endpoint
    ) {
        if (endpoint == null) {
            return new DungeonCorridorRoomEndpoint(
                    0L,
                    0L,
                    false,
                    emptyCell(),
                    DungeonEdgeDirection.NORTH,
                    DungeonTopologyRef.empty());
        }
        return new DungeonCorridorRoomEndpoint(
                endpoint.roomId(),
                endpoint.clusterId(),
                endpoint.fixedDoor(),
                domainCell(endpoint.roomCell()),
                direction(endpoint.direction()),
                domainTopologyRef(endpoint.topologyRef()));
    }

    private DungeonRoomExitDescription domainExitNarration(DungeonInspectorSnapshot.RoomExitNarration exitNarration) {
        return new DungeonRoomExitDescription(
                domainCell(exitNarration.cell()),
                DungeonEdgeDirection.parse(exitNarration.direction()),
                exitNarration.description());
    }

    private DungeonEditorHandleSnapshot toPublishedHandle(DungeonEditorHandle handle, String label) {
        return new DungeonEditorHandleSnapshot(toPublishedHandleRef(handle), label, cell(handle.cell()));
    }

    private DungeonEditorHandleRef toPublishedHandleRef(DungeonEditorHandle handle) {
        return new DungeonEditorHandleRef(
                DungeonEditorHandleKind.valueOf(handle.type().name()),
                topologyRef(handle.topologyRef()),
                handle.ownerId(),
                handle.clusterId(),
                handle.corridorId(),
                handle.roomId(),
                handle.index(),
                cell(handle.cell()),
                handle.direction().name());
    }

    private DungeonEditorHandle domainHandle(@Nullable DungeonEditorHandleRef ref) {
        if (ref == null) {
            return new DungeonEditorHandle(
                    DungeonEditorHandleType.CLUSTER_LABEL,
                    DungeonTopologyRef.empty(),
                    0L,
                    0L,
                    0L,
                    0L,
                    0,
                    emptyCell(),
                    DungeonEdgeDirection.NORTH);
        }
        return new DungeonEditorHandle(
                DungeonEditorHandleType.valueOf(ref.kind().name()),
                domainTopologyRef(ref.topologyRef()),
                ref.ownerId(),
                ref.clusterId(),
                ref.corridorId(),
                ref.roomId(),
                ref.index(),
                domainCell(ref.cell()),
                direction(ref.direction()));
    }

    private DungeonTopologyElementRef topologyRef(@Nullable DungeonTopologyRef ref) {
        if (ref == null) {
            return DungeonTopologyElementRef.empty();
        }
        return new DungeonTopologyElementRef(
                src.domain.dungeon.published.DungeonTopologyElementKind.valueOf(ref.kind().name()),
                ref.id());
    }

    private DungeonTopologyRef domainTopologyRef(@Nullable DungeonTopologyElementRef ref) {
        if (ref == null) {
            return DungeonTopologyRef.empty();
        }
        return new DungeonTopologyRef(DungeonTopologyElementKind.valueOf(ref.kind().name()), ref.id());
    }

    private DungeonMapId id(@Nullable DungeonMapIdentity identity) {
        return new DungeonMapId(identity == null ? 1L : identity.value());
    }

    private DungeonMapIdentity domainId(@Nullable DungeonMapId mapId) {
        return new DungeonMapIdentity(mapId == null ? 1L : mapId.value());
    }

    private int revision(long revision) {
        if (revision > Integer.MAX_VALUE) {
            return Integer.MAX_VALUE;
        }
        return Math.max(0, (int) revision);
    }

    private DungeonCellRef cell(DungeonCell cell) {
        return new DungeonCellRef(cell.q(), cell.r(), cell.level());
    }

    private DungeonCell domainCell(@Nullable DungeonCellRef cell) {
        return cell == null ? emptyCell() : new DungeonCell(cell.q(), cell.r(), cell.level());
    }

    private DungeonCell emptyCell() {
        return new DungeonCell(0, 0, 0);
    }

    private DungeonEdgeRef edge(DungeonEdge edge) {
        return new DungeonEdgeRef(cell(edge.from()), cell(edge.to()));
    }

    private DungeonEdge domainEdge(@Nullable DungeonEdgeRef edge) {
        if (edge == null) {
            DungeonCell origin = emptyCell();
            return new DungeonEdge(origin, origin);
        }
        return new DungeonEdge(domainCell(edge.from()), domainCell(edge.to()));
    }

    private DungeonEdgeDirection direction(@Nullable String direction) {
        return direction == null || direction.isBlank()
                ? DungeonEdgeDirection.NORTH
                : DungeonEdgeDirection.parse(direction);
    }

    private String aggregateSummary(DungeonAggregate aggregate) {
        return aggregate.label() + " #" + aggregate.id();
    }
}
