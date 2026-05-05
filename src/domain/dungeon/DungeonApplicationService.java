package src.domain.dungeon;

import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.function.BiFunction;
import java.util.function.Function;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.application.ApplyDungeonEditorOperationUseCase;
import src.domain.dungeon.application.BuildDungeonDerivedStateUseCase;
import src.domain.dungeon.application.CreateDungeonMapUseCase;
import src.domain.dungeon.application.DeleteDungeonMapUseCase;
import src.domain.dungeon.application.LoadDungeonSnapshotUseCase;
import src.domain.dungeon.application.LoadDungeonTravelSurfaceUseCase;
import src.domain.dungeon.application.LoadMapSnapshotUseCase;
import src.domain.dungeon.application.MoveDungeonTravelActionUseCase;
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
import src.domain.dungeon.map.value.DungeonEditorHandle;
import src.domain.dungeon.map.value.DungeonEditorHandleFacts;
import src.domain.dungeon.map.value.DungeonEditorHandleType;
import src.domain.dungeon.map.value.DungeonEdge;
import src.domain.dungeon.map.value.DungeonEdgeDirection;
import src.domain.dungeon.map.value.DungeonFeatureFacts;
import src.domain.dungeon.map.value.DungeonMapFacts;
import src.domain.dungeon.map.value.DungeonMapIdentity;
import src.domain.dungeon.map.value.DungeonRoomExitDescription;
import src.domain.dungeon.map.value.DungeonTopology;
import src.domain.dungeon.map.value.DungeonTopologyRef;
import src.domain.dungeon.map.value.DungeonTravelActionFacts;
import src.domain.dungeon.map.value.DungeonTravelExternalTargetFacts;
import src.domain.dungeon.map.value.DungeonTravelMoveFacts;
import src.domain.dungeon.map.value.DungeonTravelPositionFacts;
import src.domain.dungeon.map.value.DungeonTravelSurfaceFacts;
import src.domain.dungeon.published.ApplyDungeonEditorOperationCommand;
import src.domain.dungeon.published.BaseMapSnapshot;
import src.domain.dungeon.published.CreateDungeonMapCommand;
import src.domain.dungeon.published.CreateDungeonMapResult;
import src.domain.dungeon.published.DeleteDungeonMapCommand;
import src.domain.dungeon.published.DeleteDungeonMapResult;
import src.domain.dungeon.published.DescribeDungeonSelectionQuery;
import src.domain.dungeon.published.DungeonAreaKind;
import src.domain.dungeon.published.DungeonAreaSnapshot;
import src.domain.dungeon.published.DungeonBoundaryKind;
import src.domain.dungeon.published.DungeonBoundarySnapshot;
import src.domain.dungeon.published.DungeonCellRef;
import src.domain.dungeon.published.DungeonEditorHandleKind;
import src.domain.dungeon.published.DungeonEditorHandleRef;
import src.domain.dungeon.published.DungeonEditorHandleSnapshot;
import src.domain.dungeon.published.DungeonEditorOperation;
import src.domain.dungeon.published.DungeonEdgeRef;
import src.domain.dungeon.published.DungeonFeatureKind;
import src.domain.dungeon.published.DungeonFeatureSnapshot;
import src.domain.dungeon.published.DungeonInspectorSnapshot;
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
import src.domain.dungeon.published.DungeonTravelContextKind;
import src.domain.dungeon.published.DungeonTravelExternalTarget;
import src.domain.dungeon.published.DungeonTravelHeading;
import src.domain.dungeon.published.DungeonTravelLocationKind;
import src.domain.dungeon.published.DungeonTravelMoveResult;
import src.domain.dungeon.published.DungeonTravelMoveStatus;
import src.domain.dungeon.published.DungeonTravelPosition;
import src.domain.dungeon.published.DungeonTravelSurfaceSnapshot;
import src.domain.dungeon.published.LoadDungeonSnapshotQuery;
import src.domain.dungeon.published.LoadDungeonTravelSurfaceQuery;
import src.domain.dungeon.published.LoadMapSnapshotQuery;
import src.domain.dungeon.published.MoveDungeonTravelActionCommand;
import src.domain.dungeon.published.PreviewDungeonEditorOperationQuery;
import src.domain.dungeon.published.RenameDungeonMapCommand;
import src.domain.dungeon.published.RenameDungeonMapResult;
import src.domain.dungeon.published.SearchMapsQuery;
import src.domain.dungeon.published.SearchMapsResult;

/**
 * Public dungeon feature facade used by editor and travel interactors.
 */
public final class DungeonApplicationService {

    private final Function<DungeonMapIdentity, LoadDungeonSnapshotUseCase.DungeonSnapshotData> loadSnapshotPath;
    private final EditorOperationPath applyOperationPath;
    private final EditorOperationPath previewOperationPath;
    private final SelectionDescriptionPath describeSelectionPath;
    private final Function<String, List<SearchDungeonMapsUseCase.MapSummary>> searchMapsPath;
    private final Function<String, CreateDungeonMapUseCase.CreatedMap> createMapPath;
    private final BiFunction<DungeonMapIdentity, String, RenameDungeonMapUseCase.RenamedMap> renameMapPath;
    private final Function<DungeonMapIdentity, DungeonMapIdentity> deleteMapPath;
    private final MapSnapshotPath loadMapSnapshotPath;
    private final Function<DungeonTravelPositionFacts, DungeonTravelSurfaceFacts> loadTravelSurfacePath;
    private final Function<MoveDungeonTravelActionUseCase.Input, DungeonTravelMoveFacts> moveTravelActionPath;

    public DungeonApplicationService(
            DungeonMapRepository mapRepository,
            DungeonMapSearch mapSearch
    ) {
        DungeonMapRepository repository = Objects.requireNonNull(mapRepository, "mapRepository");
        DungeonMapSearch search = Objects.requireNonNull(mapSearch, "mapSearch");
        BuildDungeonDerivedStateUseCase derive = new BuildDungeonDerivedStateUseCase();

        LoadDungeonSnapshotUseCase loadDungeonSnapshotUseCase = new LoadDungeonSnapshotUseCase(repository, search, derive);
        ApplyDungeonEditorOperationUseCase applyDungeonEditorOperationUseCase =
                new ApplyDungeonEditorOperationUseCase(repository, search, derive);
        SearchDungeonMapsUseCase searchDungeonMapsUseCase = new SearchDungeonMapsUseCase(search);
        CreateDungeonMapUseCase createDungeonMapUseCase = new CreateDungeonMapUseCase(repository);
        RenameDungeonMapUseCase renameDungeonMapUseCase = new RenameDungeonMapUseCase(repository);
        DeleteDungeonMapUseCase deleteDungeonMapUseCase = new DeleteDungeonMapUseCase(repository);
        LoadMapSnapshotUseCase loadMapSnapshotUseCase = new LoadMapSnapshotUseCase(repository, derive);
        LoadDungeonTravelSurfaceUseCase loadDungeonTravelSurfaceUseCase =
                new LoadDungeonTravelSurfaceUseCase(repository, search, derive);
        MoveDungeonTravelActionUseCase moveDungeonTravelActionUseCase =
                new MoveDungeonTravelActionUseCase(repository, search, derive);

        this.loadSnapshotPath = loadDungeonSnapshotUseCase::execute;
        this.applyOperationPath = applyDungeonEditorOperationUseCase::execute;
        this.previewOperationPath = applyDungeonEditorOperationUseCase::preview;
        this.describeSelectionPath = loadDungeonSnapshotUseCase::describeSelection;
        this.searchMapsPath = searchDungeonMapsUseCase::execute;
        this.createMapPath = createDungeonMapUseCase::execute;
        this.renameMapPath = renameDungeonMapUseCase::execute;
        this.deleteMapPath = deleteDungeonMapUseCase::execute;
        this.loadMapSnapshotPath = loadMapSnapshotUseCase::execute;
        this.loadTravelSurfacePath = position -> loadDungeonTravelSurfaceUseCase.execute(
                new LoadDungeonTravelSurfaceUseCase.Input(position));
        this.moveTravelActionPath = moveDungeonTravelActionUseCase::execute;
    }

    public DungeonSnapshot loadSnapshot(LoadDungeonSnapshotQuery query) {
        LoadDungeonSnapshotQuery effectiveQuery = query == null ? new LoadDungeonSnapshotQuery() : query;
        return AuthoredSnapshotPublication.snapshot(
                loadSnapshotPath.apply(ScalarTranslation.domainId(effectiveQuery.mapId())));
    }

    public DungeonOperationResult applyOperation(ApplyDungeonEditorOperationCommand command) {
        return EditorOperationPublication.result(applyOperationPath.execute(
                ScalarTranslation.domainId(command == null ? null : command.mapId()),
                EditorOperationInputTranslation.operationInput(command == null ? null : command.operation())));
    }

    public DungeonOperationResult previewOperation(PreviewDungeonEditorOperationQuery query) {
        return EditorOperationPublication.result(previewOperationPath.execute(
                ScalarTranslation.domainId(query == null ? null : query.mapId()),
                EditorOperationInputTranslation.operationInput(query == null ? null : query.operation())));
    }

    public DungeonInspectorSnapshot describeSelection(DescribeDungeonSelectionQuery query) {
        DescribeDungeonSelectionQuery effectiveQuery = query == null
                ? new DescribeDungeonSelectionQuery(new DungeonMapId(1L), DungeonTopologyElementRef.empty(), 0L, false)
                : query;
        return AuthoredSnapshotPublication.inspectorSnapshot(describeSelectionPath.load(
                ScalarTranslation.domainId(effectiveQuery.mapId()),
                ScalarTranslation.domainTopologyRef(effectiveQuery.topologyRef()),
                effectiveQuery.clusterId(),
                effectiveQuery.clusterSelection()));
    }

    public SearchMapsResult searchMaps(SearchMapsQuery query) {
        SearchMapsQuery effectiveQuery = query == null ? new SearchMapsQuery("") : query;
        return MapSummaryPublication.result(searchMapsPath.apply(effectiveQuery.query()));
    }

    public CreateDungeonMapResult createMap(CreateDungeonMapCommand command) {
        CreateDungeonMapCommand effectiveCommand = command == null ? new CreateDungeonMapCommand("") : command;
        return MapMutationPublication.created(createMapPath.apply(effectiveCommand.mapName()));
    }

    public RenameDungeonMapResult renameMap(RenameDungeonMapCommand command) {
        RenameDungeonMapCommand effectiveCommand = command == null
                ? new RenameDungeonMapCommand(new DungeonMapId(1L), "")
                : command;
        return MapMutationPublication.renamed(renameMapPath.apply(
                ScalarTranslation.domainId(effectiveCommand.mapId()),
                effectiveCommand.mapName()));
    }

    public DeleteDungeonMapResult deleteMap(DeleteDungeonMapCommand command) {
        DeleteDungeonMapCommand effectiveCommand = command == null
                ? new DeleteDungeonMapCommand(new DungeonMapId(1L))
                : command;
        return MapMutationPublication.deleted(
                deleteMapPath.apply(ScalarTranslation.domainId(effectiveCommand.mapId())));
    }

    public BaseMapSnapshot loadMapSnapshot(LoadMapSnapshotQuery query) {
        LoadMapSnapshotQuery effectiveQuery = query == null
                ? new LoadMapSnapshotQuery(new DungeonMapId(1L), 0)
                : query;
        return MapSnapshotPublication.baseMapSnapshot(loadMapSnapshotPath.load(
                ScalarTranslation.domainId(effectiveQuery.mapId()),
                effectiveQuery.targetFloor()));
    }

    public DungeonTravelSurfaceSnapshot loadTravelSurface(LoadDungeonTravelSurfaceQuery query) {
        LoadDungeonTravelSurfaceQuery effectiveQuery = query == null
                ? new LoadDungeonTravelSurfaceQuery(null)
                : query;
        return TravelSurfacePublication.surface(loadTravelSurfacePath.apply(
                TravelSurfacePublication.domainPosition(effectiveQuery.position())));
    }

    public DungeonTravelMoveResult moveTravelAction(MoveDungeonTravelActionCommand command) {
        MoveDungeonTravelActionCommand effectiveCommand = command == null
                ? new MoveDungeonTravelActionCommand(null, "")
                : command;
        return TravelSurfacePublication.moveResult(moveTravelActionPath.apply(
                new MoveDungeonTravelActionUseCase.Input(
                        TravelSurfacePublication.domainPosition(effectiveCommand.position()),
                        effectiveCommand.actionId())));
    }

    @FunctionalInterface
    private interface EditorOperationPath {
        ApplyDungeonEditorOperationUseCase.OperationResultData execute(
                @Nullable DungeonMapIdentity mapId,
                ApplyDungeonEditorOperationUseCase.OperationInput input
        );
    }

    @FunctionalInterface
    private interface SelectionDescriptionPath {
        LoadDungeonSnapshotUseCase.InspectorSnapshotData load(
                DungeonMapIdentity mapId,
                DungeonTopologyRef topologyRef,
                long clusterId,
                boolean clusterSelection
        );
    }

    @FunctionalInterface
    private interface MapSnapshotPath {
        LoadMapSnapshotUseCase.MapSnapshotData load(DungeonMapIdentity mapId, int targetFloor);
    }

    private static final class AuthoredSnapshotPublication {

        private AuthoredSnapshotPublication() {
        }

        private static DungeonSnapshot snapshot(LoadDungeonSnapshotUseCase.DungeonSnapshotData snapshot) {
            return new DungeonSnapshot(
                    snapshot.mapName(),
                    DungeonMapMode.EDITOR,
                    MapSnapshotPublication.mapSnapshot(snapshot.derived().map(), snapshot.editorHandles()),
                    snapshot.derived().aggregates().stream().map(AuthoredSnapshotPublication::aggregateSummary).toList(),
                    snapshot.derived().relations().summaries(),
                    ScalarTranslation.revision(snapshot.revision()));
        }

        private static DungeonInspectorSnapshot inspectorSnapshot(
                LoadDungeonSnapshotUseCase.InspectorSnapshotData snapshot
        ) {
            return new DungeonInspectorSnapshot(
                    snapshot.title(),
                    snapshot.description(),
                    snapshot.facts(),
                    snapshot.roomNarrations().stream().map(AuthoredSnapshotPublication::roomNarration).toList());
        }

        private static DungeonInspectorSnapshot.RoomNarrationCard roomNarration(
                LoadDungeonSnapshotUseCase.RoomNarrationData roomNarration
        ) {
            return new DungeonInspectorSnapshot.RoomNarrationCard(
                    roomNarration.roomId(),
                    roomNarration.roomName(),
                    roomNarration.visualDescription(),
                    roomNarration.exits().stream().map(AuthoredSnapshotPublication::exitNarration).toList());
        }

        private static DungeonInspectorSnapshot.RoomExitNarration exitNarration(
                LoadDungeonSnapshotUseCase.RoomExitNarrationData exitNarration
        ) {
            return new DungeonInspectorSnapshot.RoomExitNarration(
                    exitNarration.label(),
                    ScalarTranslation.cell(exitNarration.cell()),
                    exitNarration.direction().name(),
                    exitNarration.description());
        }

        private static String aggregateSummary(DungeonAggregate aggregate) {
            return aggregate.label() + " #" + aggregate.id();
        }
    }

    private static final class EditorOperationInputTranslation {

        private EditorOperationInputTranslation() {
        }

        private static ApplyDungeonEditorOperationUseCase.OperationInput operationInput(
                @Nullable DungeonEditorOperation operation
        ) {
            return movementInput(operation)
                    .or(() -> roomShapeInput(operation))
                    .or(() -> corridorInput(operation))
                    .or(() -> narrationInput(operation))
                    .orElseGet(ApplyDungeonEditorOperationUseCase.OperationInput.NoChange::new);
        }

        private static Optional<ApplyDungeonEditorOperationUseCase.OperationInput> movementInput(
                @Nullable DungeonEditorOperation operation
        ) {
            if (operation instanceof DungeonEditorOperation.MoveTopologyElement moveTopologyElement) {
                return Optional.of(new ApplyDungeonEditorOperationUseCase.OperationInput.MoveTopologyElement(
                        ScalarTranslation.domainTopologyRef(moveTopologyElement.ref()),
                        moveTopologyElement.deltaQ(),
                        moveTopologyElement.deltaR(),
                        moveTopologyElement.deltaLevel()));
            }
            if (operation instanceof DungeonEditorOperation.MoveEditorHandle moveEditorHandle) {
                return Optional.of(new ApplyDungeonEditorOperationUseCase.OperationInput.MoveEditorHandle(
                        MapSnapshotPublication.domainHandle(moveEditorHandle.ref()),
                        moveEditorHandle.deltaQ(),
                        moveEditorHandle.deltaR(),
                        moveEditorHandle.deltaLevel()));
            }
            if (operation instanceof DungeonEditorOperation.MoveBoundaryStretch moveBoundaryStretch) {
                return Optional.of(new ApplyDungeonEditorOperationUseCase.OperationInput.MoveBoundaryStretch(
                        moveBoundaryStretch.clusterId(),
                        moveBoundaryStretch.sourceEdges().stream().map(ScalarTranslation::domainEdge).toList(),
                        moveBoundaryStretch.deltaQ(),
                        moveBoundaryStretch.deltaR(),
                        moveBoundaryStretch.deltaLevel()));
            }
            if (operation instanceof DungeonEditorOperation.MoveRoomAnchor moveRoomAnchor) {
                return Optional.of(new ApplyDungeonEditorOperationUseCase.OperationInput.MoveRoomAnchor(
                        moveRoomAnchor.deltaQ(),
                        moveRoomAnchor.deltaR()));
            }
            return Optional.empty();
        }

        private static Optional<ApplyDungeonEditorOperationUseCase.OperationInput> roomShapeInput(
                @Nullable DungeonEditorOperation operation
        ) {
            if (operation instanceof DungeonEditorOperation.PaintRoomRectangle paintRoomRectangle) {
                return Optional.of(new ApplyDungeonEditorOperationUseCase.OperationInput.PaintRoomRectangle(
                        ScalarTranslation.domainCell(paintRoomRectangle.start()),
                        ScalarTranslation.domainCell(paintRoomRectangle.end())));
            }
            if (operation instanceof DungeonEditorOperation.DeleteRoomRectangle deleteRoomRectangle) {
                return Optional.of(new ApplyDungeonEditorOperationUseCase.OperationInput.DeleteRoomRectangle(
                        ScalarTranslation.domainCell(deleteRoomRectangle.start()),
                        ScalarTranslation.domainCell(deleteRoomRectangle.end())));
            }
            if (operation instanceof DungeonEditorOperation.EditClusterBoundaries editClusterBoundaries) {
                return Optional.of(new ApplyDungeonEditorOperationUseCase.OperationInput.EditClusterBoundaries(
                        editClusterBoundaries.clusterId(),
                        editClusterBoundaries.edges().stream().map(ScalarTranslation::domainEdge).toList(),
                        ScalarTranslation.domainBoundaryKind(editClusterBoundaries.kind()),
                        editClusterBoundaries.deleteBoundary()));
            }
            return Optional.empty();
        }

        private static Optional<ApplyDungeonEditorOperationUseCase.OperationInput> corridorInput(
                @Nullable DungeonEditorOperation operation
        ) {
            if (operation instanceof DungeonEditorOperation.CreateCorridor createCorridor) {
                return Optional.of(new ApplyDungeonEditorOperationUseCase.OperationInput.CreateCorridor(
                        corridorEndpoint(createCorridor.start()),
                        corridorEndpoint(createCorridor.end())));
            }
            if (operation instanceof DungeonEditorOperation.ExtendCorridor extendCorridor) {
                return Optional.of(new ApplyDungeonEditorOperationUseCase.OperationInput.ExtendCorridor(
                        extendCorridor.corridorId(),
                        corridorRoomEndpoint(extendCorridor.endpoint())));
            }
            if (operation instanceof DungeonEditorOperation.MergeCorridors mergeCorridors) {
                return Optional.of(new ApplyDungeonEditorOperationUseCase.OperationInput.MergeCorridors(
                        mergeCorridors.corridorId(),
                        mergeCorridors.mergedCorridorId()));
            }
            if (operation instanceof DungeonEditorOperation.DeleteCorridor deleteCorridor) {
                return Optional.of(
                        new ApplyDungeonEditorOperationUseCase.OperationInput.DeleteCorridor(deleteCorridor.corridorId()));
            }
            return Optional.empty();
        }

        private static Optional<ApplyDungeonEditorOperationUseCase.OperationInput> narrationInput(
                @Nullable DungeonEditorOperation operation
        ) {
            if (operation instanceof DungeonEditorOperation.SaveRoomNarration saveRoomNarration) {
                return Optional.of(new ApplyDungeonEditorOperationUseCase.OperationInput.SaveRoomNarration(
                        saveRoomNarration.roomId(),
                        saveRoomNarration.visualDescription(),
                        saveRoomNarration.exits().stream().map(EditorOperationInputTranslation::domainExitNarration).toList()));
            }
            return Optional.empty();
        }

        private static ApplyDungeonEditorOperationUseCase.OperationInput.CorridorEndpoint corridorEndpoint(
                DungeonEditorOperation.CorridorEndpoint endpoint
        ) {
            if (endpoint instanceof DungeonEditorOperation.CorridorDoorEndpoint doorEndpoint) {
                return new ApplyDungeonEditorOperationUseCase.OperationInput.CorridorDoorEndpoint(
                        doorEndpoint.roomId(),
                        doorEndpoint.clusterId(),
                        ScalarTranslation.domainCell(doorEndpoint.roomCell()),
                        ScalarTranslation.direction(doorEndpoint.direction()),
                        ScalarTranslation.domainTopologyRef(doorEndpoint.topologyRef()));
            }
            if (endpoint instanceof DungeonEditorOperation.CorridorAnchorEndpoint anchorEndpoint) {
                return new ApplyDungeonEditorOperationUseCase.OperationInput.CorridorAnchorEndpoint(
                        anchorEndpoint.hostCorridorId(),
                        ScalarTranslation.domainCell(anchorEndpoint.anchorCell()),
                        ScalarTranslation.domainTopologyRef(anchorEndpoint.topologyRef()));
            }
            return new ApplyDungeonEditorOperationUseCase.OperationInput.CorridorDoorEndpoint(
                    0L,
                    0L,
                    ScalarTranslation.emptyCell(),
                    DungeonEdgeDirection.NORTH,
                    DungeonTopologyRef.empty());
        }

        private static ApplyDungeonEditorOperationUseCase.OperationInput.CorridorRoomEndpoint corridorRoomEndpoint(
                DungeonEditorOperation.@Nullable CorridorRoomEndpoint endpoint
        ) {
            if (endpoint == null) {
                return new ApplyDungeonEditorOperationUseCase.OperationInput.CorridorRoomEndpoint(
                        0L,
                        0L,
                        false,
                        ScalarTranslation.emptyCell(),
                        DungeonEdgeDirection.NORTH,
                        DungeonTopologyRef.empty());
            }
            return new ApplyDungeonEditorOperationUseCase.OperationInput.CorridorRoomEndpoint(
                    endpoint.roomId(),
                    endpoint.clusterId(),
                    endpoint.fixedDoor(),
                    ScalarTranslation.domainCell(endpoint.roomCell()),
                    ScalarTranslation.direction(endpoint.direction()),
                    ScalarTranslation.domainTopologyRef(endpoint.topologyRef()));
        }

        private static DungeonRoomExitDescription domainExitNarration(
                DungeonInspectorSnapshot.RoomExitNarration exitNarration
        ) {
            return new DungeonRoomExitDescription(
                    ScalarTranslation.domainCell(exitNarration.cell()),
                    src.domain.dungeon.map.value.DungeonEdgeDirection.parse(exitNarration.direction()),
                    exitNarration.description());
        }
    }

    private static final class EditorOperationPublication {

        private EditorOperationPublication() {
        }

        private static DungeonOperationResult result(ApplyDungeonEditorOperationUseCase.OperationResultData result) {
            return new DungeonOperationResult(
                    AuthoredSnapshotPublication.snapshot(result.snapshot()),
                    result.validationMessages(),
                    result.reactionMessages());
        }
    }

    private static final class MapSummaryPublication {

        private MapSummaryPublication() {
        }

        private static SearchMapsResult result(List<SearchDungeonMapsUseCase.MapSummary> summaries) {
            return new SearchMapsResult(summaries.stream().map(MapSummaryPublication::summary).toList());
        }

        private static DungeonMapSummary summary(SearchDungeonMapsUseCase.MapSummary summary) {
            return new DungeonMapSummary(
                    ScalarTranslation.id(summary.mapId()),
                    summary.mapName(),
                    summary.revision());
        }
    }

    private static final class MapSnapshotPublication {

        private MapSnapshotPublication() {
        }

        private static BaseMapSnapshot baseMapSnapshot(LoadMapSnapshotUseCase.MapSnapshotData snapshot) {
            return new BaseMapSnapshot(
                    ScalarTranslation.id(snapshot.mapId()),
                    snapshot.mapName(),
                    snapshot.revision(),
                    snapshot.targetFloor(),
                    mapSnapshot(snapshot.map()),
                    snapshot.empty());
        }

        private static DungeonMapSnapshot mapSnapshot(DungeonMapFacts facts) {
            return mapSnapshot(facts, List.of());
        }

        private static DungeonMapSnapshot mapSnapshot(DungeonMapFacts facts, List<DungeonEditorHandleFacts> handles) {
            DungeonMapFacts safeFacts = facts == null
                    ? new DungeonMapFacts(DungeonTopology.SQUARE, 1, 1, List.of(), List.of())
                    : facts;
            return new DungeonMapSnapshot(
                    topology(safeFacts.topology()),
                    safeFacts.width(),
                    safeFacts.height(),
                    safeFacts.areas().stream().map(MapSnapshotPublication::area).toList(),
                    safeFacts.boundaries().stream().map(MapSnapshotPublication::boundary).toList(),
                    safeFacts.features().stream().map(MapSnapshotPublication::feature).toList(),
                    handles == null ? List.of() : handles.stream().map(MapSnapshotPublication::handle).toList());
        }

        private static DungeonAreaSnapshot area(DungeonAreaFacts area) {
            return new DungeonAreaSnapshot(
                    areaKind(area.kind()),
                    area.id(),
                    area.clusterId(),
                    area.label(),
                    area.cells().stream().map(ScalarTranslation::cell).toList(),
                    ScalarTranslation.topologyRef(area.topologyRef()));
        }

        private static DungeonBoundarySnapshot boundary(DungeonBoundaryFacts boundary) {
            return new DungeonBoundarySnapshot(
                    boundary.kind(),
                    boundary.id(),
                    boundary.label(),
                    ScalarTranslation.edge(boundary.edge()),
                    ScalarTranslation.topologyRef(boundary.topologyRef()));
        }

        private static DungeonFeatureSnapshot feature(DungeonFeatureFacts feature) {
            return new DungeonFeatureSnapshot(
                    DungeonFeatureKind.valueOf(feature.kind().name()),
                    feature.id(),
                    feature.label(),
                    feature.cells().stream().map(ScalarTranslation::cell).toList(),
                    feature.description(),
                    feature.destinationLabel(),
                    ScalarTranslation.topologyRef(feature.topologyRef()));
        }

        private static DungeonEditorHandleSnapshot handle(DungeonEditorHandleFacts handle) {
            return new DungeonEditorHandleSnapshot(
                    handleRef(handle.handle()),
                    handle.label(),
                    ScalarTranslation.cell(handle.handle().cell()));
        }

        private static DungeonEditorHandleRef handleRef(DungeonEditorHandle handle) {
            return new DungeonEditorHandleRef(
                    DungeonEditorHandleKind.valueOf(handle.type().name()),
                    ScalarTranslation.topologyRef(handle.topologyRef()),
                    handle.ownerId(),
                    handle.clusterId(),
                    handle.corridorId(),
                    handle.roomId(),
                    handle.index(),
                    ScalarTranslation.cell(handle.cell()),
                    handle.direction().name());
        }

        private static DungeonEditorHandle domainHandle(@Nullable DungeonEditorHandleRef ref) {
            if (ref == null) {
                return new DungeonEditorHandle(
                        DungeonEditorHandleType.CLUSTER_LABEL,
                        DungeonTopologyRef.empty(),
                        0L,
                        0L,
                        0L,
                        0L,
                        0,
                        ScalarTranslation.emptyCell(),
                        DungeonEdgeDirection.NORTH);
            }
            return new DungeonEditorHandle(
                    DungeonEditorHandleType.valueOf(ref.kind().name()),
                    ScalarTranslation.domainTopologyRef(ref.topologyRef()),
                    ref.ownerId(),
                    ref.clusterId(),
                    ref.corridorId(),
                    ref.roomId(),
                    ref.index(),
                    ScalarTranslation.domainCell(ref.cell()),
                    ScalarTranslation.direction(ref.direction()));
        }

        private static DungeonAreaKind areaKind(DungeonAreaType kind) {
            return kind == DungeonAreaType.CORRIDOR ? DungeonAreaKind.CORRIDOR : DungeonAreaKind.ROOM;
        }

        private static DungeonTopologyKind topology(DungeonTopology topology) {
            return topology == DungeonTopology.HEX ? DungeonTopologyKind.HEX : DungeonTopologyKind.SQUARE;
        }
    }

    private static final class MapMutationPublication {

        private MapMutationPublication() {
        }

        private static CreateDungeonMapResult created(CreateDungeonMapUseCase.CreatedMap result) {
            return new CreateDungeonMapResult(ScalarTranslation.id(result.mapId()));
        }

        private static RenameDungeonMapResult renamed(RenameDungeonMapUseCase.RenamedMap result) {
            return new RenameDungeonMapResult(ScalarTranslation.id(result.mapId()));
        }

        private static DeleteDungeonMapResult deleted(DungeonMapIdentity mapId) {
            return new DeleteDungeonMapResult(ScalarTranslation.id(mapId));
        }
    }

    private static final class TravelSurfacePublication {

        private TravelSurfacePublication() {
        }

        private static DungeonTravelSurfaceSnapshot surface(DungeonTravelSurfaceFacts surface) {
            return new DungeonTravelSurfaceSnapshot(
                    DungeonTravelContextKind.DUNGEON,
                    surface.mapName(),
                    ScalarTranslation.revision(surface.revision()),
                    MapSnapshotPublication.mapSnapshot(surface.map()),
                    position(surface.position()),
                    surface.surfaceTitle(),
                    surface.areaLabel(),
                    surface.tileLabel(),
                    surface.headingLabel(),
                    surface.statusLabel(),
                    surface.visualDescription(),
                    surface.actions().stream().map(TravelSurfacePublication::action).toList());
        }

        private static DungeonTravelMoveResult moveResult(DungeonTravelMoveFacts result) {
            return new DungeonTravelMoveResult(
                    DungeonTravelMoveStatus.valueOf(result.status().name()),
                    result.message(),
                    surface(result.surface()),
                    externalTarget(result.externalTarget()));
        }

        private static DungeonTravelActionSnapshot action(DungeonTravelActionFacts action) {
            return new DungeonTravelActionSnapshot(
                    action.actionId(),
                    DungeonTravelActionKind.valueOf(action.kind().name()),
                    action.label(),
                    action.destinationLabel(),
                    action.description());
        }

        private static @Nullable DungeonTravelExternalTarget externalTarget(
                @Nullable DungeonTravelExternalTargetFacts externalTarget
        ) {
            if (externalTarget instanceof DungeonTravelExternalTargetFacts.OverworldTile overworld) {
                return new DungeonTravelExternalTarget.OverworldTile(overworld.mapId(), overworld.tileId());
            }
            return null;
        }

        private static DungeonTravelPosition position(DungeonTravelPositionFacts position) {
            return new DungeonTravelPosition(
                    ScalarTranslation.id(position.mapId()),
                    DungeonTravelLocationKind.valueOf(position.locationKind().name()),
                    position.ownerId(),
                    ScalarTranslation.cell(position.tile()),
                    DungeonTravelHeading.valueOf(position.heading().name()));
        }

        private static @Nullable DungeonTravelPositionFacts domainPosition(@Nullable DungeonTravelPosition position) {
            if (position == null) {
                return null;
            }
            return new DungeonTravelPositionFacts(
                    ScalarTranslation.domainId(position.mapId()),
                    src.domain.dungeon.map.value.DungeonTravelLocationKind.valueOf(position.locationKind().name()),
                    position.ownerId(),
                    ScalarTranslation.domainCell(position.tile()),
                    src.domain.dungeon.map.value.DungeonTravelHeading.valueOf(position.heading().name()));
        }
    }

    private static final class ScalarTranslation {

        private ScalarTranslation() {
        }

        private static DungeonMapId id(@Nullable DungeonMapIdentity identity) {
            return new DungeonMapId(identity == null ? 1L : identity.value());
        }

        private static DungeonMapIdentity domainId(@Nullable DungeonMapId mapId) {
            return new DungeonMapIdentity(mapId == null ? 1L : mapId.value());
        }

        private static DungeonTopologyElementRef topologyRef(@Nullable DungeonTopologyRef ref) {
            if (ref == null) {
                return DungeonTopologyElementRef.empty();
            }
            return new DungeonTopologyElementRef(
                    src.domain.dungeon.published.DungeonTopologyElementKind.valueOf(ref.kind().name()),
                    ref.id());
        }

        private static DungeonTopologyRef domainTopologyRef(@Nullable DungeonTopologyElementRef ref) {
            if (ref == null) {
                return DungeonTopologyRef.empty();
            }
            return new DungeonTopologyRef(
                    src.domain.dungeon.map.value.DungeonTopologyElementKind.valueOf(ref.kind().name()),
                    ref.id());
        }

        private static DungeonCellRef cell(DungeonCell cell) {
            return new DungeonCellRef(cell.q(), cell.r(), cell.level());
        }

        private static DungeonCell domainCell(@Nullable DungeonCellRef cell) {
            return cell == null ? emptyCell() : new DungeonCell(cell.q(), cell.r(), cell.level());
        }

        private static DungeonCell emptyCell() {
            return new DungeonCell(0, 0, 0);
        }

        private static DungeonEdgeRef edge(DungeonEdge edge) {
            return new DungeonEdgeRef(cell(edge.from()), cell(edge.to()));
        }

        private static DungeonEdge domainEdge(@Nullable DungeonEdgeRef edge) {
            if (edge == null) {
                DungeonCell origin = emptyCell();
                return new DungeonEdge(origin, origin);
            }
            return new DungeonEdge(domainCell(edge.from()), domainCell(edge.to()));
        }

        private static DungeonClusterBoundaryKind domainBoundaryKind(@Nullable DungeonBoundaryKind kind) {
            return kind == DungeonBoundaryKind.DOOR
                    ? DungeonClusterBoundaryKind.DOOR
                    : DungeonClusterBoundaryKind.WALL;
        }

        private static DungeonEdgeDirection direction(@Nullable String direction) {
            return direction == null || direction.isBlank()
                    ? DungeonEdgeDirection.NORTH
                    : DungeonEdgeDirection.parse(direction);
        }

        private static int revision(long revision) {
            if (revision > Integer.MAX_VALUE) {
                return Integer.MAX_VALUE;
            }
            return Math.max(0, (int) revision);
        }
    }
}
