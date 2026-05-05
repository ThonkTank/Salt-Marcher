package src.domain.dungeon;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.function.Consumer;
import java.util.function.Function;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.application.ApplyDungeonEditorOperationUseCase;
import src.domain.dungeon.application.BuildDungeonDerivedStateUseCase;
import src.domain.dungeon.application.CreateDungeonMapUseCase;
import src.domain.dungeon.application.DeleteDungeonMapUseCase;
import src.domain.dungeon.application.LoadDungeonSnapshotUseCase;
import src.domain.dungeon.application.LoadMapSnapshotUseCase;
import src.domain.dungeon.application.LoadDungeonTravelSurfaceUseCase;
import src.domain.dungeon.application.MoveDungeonTravelActionUseCase;
import src.domain.dungeon.application.RenameDungeonMapUseCase;
import src.domain.dungeon.application.SearchDungeonMapsUseCase;
import src.domain.dungeon.published.ApplyDungeonEditorOperationCommand;
import src.domain.dungeon.published.ApplyDungeonEditorSessionCommand;
import src.domain.dungeon.published.ApplyDungeonSurfaceEditCommand;
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
import src.domain.dungeon.published.DungeonEditorModel;
import src.domain.dungeon.published.DungeonEditorOperation;
import src.domain.dungeon.published.DungeonEditorPreview;
import src.domain.dungeon.published.DungeonEditorSnapshot;
import src.domain.dungeon.published.DungeonEdgeRef;
import src.domain.dungeon.published.DungeonFeatureKind;
import src.domain.dungeon.published.DungeonFeatureSnapshot;
import src.domain.dungeon.published.DungeonInspectorSnapshot;
import src.domain.dungeon.published.DungeonMapId;
import src.domain.dungeon.published.DungeonMapMode;
import src.domain.dungeon.published.DungeonMapSnapshot;
import src.domain.dungeon.published.DungeonMapSummary;
import src.domain.dungeon.published.DungeonOperationResult;
import src.domain.dungeon.published.DungeonOverlaySettings;
import src.domain.dungeon.published.DungeonSnapshot;
import src.domain.dungeon.published.DungeonSurfaceEdit;
import src.domain.dungeon.published.DungeonSurfaceKind;
import src.domain.dungeon.published.DungeonSurfaceMessages;
import src.domain.dungeon.published.DungeonSurfacePayload;
import src.domain.dungeon.published.DungeonSurfaceTravel;
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
import src.domain.dungeon.published.LoadDungeonEditorQuery;
import src.domain.dungeon.published.LoadDungeonSnapshotQuery;
import src.domain.dungeon.published.LoadDungeonSurfaceQuery;
import src.domain.dungeon.published.LoadDungeonTravelSurfaceQuery;
import src.domain.dungeon.published.LoadMapSnapshotQuery;
import src.domain.dungeon.published.MoveDungeonTravelActionCommand;
import src.domain.dungeon.published.PreviewDungeonEditorOperationQuery;
import src.domain.dungeon.published.PreviewDungeonSurfaceEditQuery;
import src.domain.dungeon.published.RenameDungeonMapCommand;
import src.domain.dungeon.published.RenameDungeonMapResult;
import src.domain.dungeon.published.SearchMapsQuery;
import src.domain.dungeon.published.SearchMapsResult;
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
import src.domain.dungeon.map.value.DungeonEdgeDirection;
import src.domain.dungeon.map.value.DungeonEdge;
import src.domain.dungeon.map.value.DungeonFeatureFacts;
import src.domain.dungeon.map.value.DungeonMapFacts;
import src.domain.dungeon.map.value.DungeonMapIdentity;
import src.domain.dungeon.map.value.DungeonRoomExitDescription;
import src.domain.dungeon.map.value.DungeonTopologyRef;
import src.domain.dungeon.map.value.DungeonTopology;
import src.domain.dungeon.map.value.DungeonTravelActionFacts;
import src.domain.dungeon.map.value.DungeonTravelExternalTargetFacts;
import src.domain.dungeon.map.value.DungeonTravelMoveFacts;
import src.domain.dungeon.map.value.DungeonTravelPositionFacts;
import src.domain.dungeon.map.value.DungeonTravelSurfaceFacts;

/**
 * Public dungeon feature facade used by editor and travel interactors.
 */
public final class DungeonApplicationService {

    private final LoadDungeonSnapshotUseCase loadDungeonSnapshotUseCase;
    private final ApplyDungeonEditorOperationUseCase applyDungeonEditorOperationUseCase;
    private final SearchDungeonMapsUseCase searchDungeonMapsUseCase;
    private final CreateDungeonMapUseCase createDungeonMapUseCase;
    private final RenameDungeonMapUseCase renameDungeonMapUseCase;
    private final DeleteDungeonMapUseCase deleteDungeonMapUseCase;
    private final LoadMapSnapshotUseCase loadMapSnapshotUseCase;
    private final LoadDungeonTravelSurfaceUseCase loadDungeonTravelSurfaceUseCase;
    private final MoveDungeonTravelActionUseCase moveDungeonTravelActionUseCase;
    private final BuildDungeonEditorSnapshotUseCase buildDungeonEditorSnapshotUseCase;
    private final ApplyDungeonEditorSessionUseCase applyDungeonEditorSessionUseCase;
    private final List<Consumer<DungeonEditorSnapshot>> editorListeners = new ArrayList<>();
    private final DungeonEditorModel editorModel = new DungeonEditorModel(
            this::currentEditorSnapshot,
            this::subscribeEditorListener);

    public DungeonApplicationService(
            DungeonMapRepository mapRepository,
            DungeonMapSearch mapSearch
    ) {
        DungeonMapRepository repository = Objects.requireNonNull(mapRepository, "mapRepository");
        DungeonMapSearch search = Objects.requireNonNull(mapSearch, "mapSearch");
        BuildDungeonDerivedStateUseCase derive = new BuildDungeonDerivedStateUseCase();
        this.loadDungeonSnapshotUseCase = new LoadDungeonSnapshotUseCase(repository, search, derive);
        this.applyDungeonEditorOperationUseCase = new ApplyDungeonEditorOperationUseCase(
                repository,
                search,
                derive);
        this.searchDungeonMapsUseCase = new SearchDungeonMapsUseCase(search);
        this.createDungeonMapUseCase = new CreateDungeonMapUseCase(repository);
        this.renameDungeonMapUseCase = new RenameDungeonMapUseCase(repository);
        this.deleteDungeonMapUseCase = new DeleteDungeonMapUseCase(repository);
        this.loadMapSnapshotUseCase = new LoadMapSnapshotUseCase(repository, derive);
        this.loadDungeonTravelSurfaceUseCase = new LoadDungeonTravelSurfaceUseCase(repository, search, derive);
        this.moveDungeonTravelActionUseCase = new MoveDungeonTravelActionUseCase(repository, search, derive);
        this.buildDungeonEditorSnapshotUseCase = new BuildDungeonEditorSnapshotUseCase(
                this::searchMaps,
                this::loadSurface,
                this::previewSurfaceEdit,
                this::describeSelection,
                this::loadSnapshot);
        this.applyDungeonEditorSessionUseCase = new ApplyDungeonEditorSessionUseCase(
                this::createMap,
                this::renameMap,
                this::deleteMap,
                this::applySurfaceEdit,
                buildDungeonEditorSnapshotUseCase);
    }

    public DungeonEditorModel loadEditor(LoadDungeonEditorQuery query) {
        LoadDungeonEditorQuery effectiveQuery = query == null ? new LoadDungeonEditorQuery(null) : query;
        if (effectiveQuery.mapId() != null) {
            applyDungeonEditorSessionUseCase.primeSelectedMap(effectiveQuery.mapId());
        }
        return editorModel;
    }

    public DungeonEditorSnapshot applyEditorSession(ApplyDungeonEditorSessionCommand command) {
        applyDungeonEditorSessionUseCase.apply(command);
        DungeonEditorSnapshot snapshot = currentEditorSnapshot();
        notifyEditorListeners(snapshot);
        return snapshot;
    }

    public DungeonSnapshot loadSnapshot(LoadDungeonSnapshotQuery query) {
        LoadDungeonSnapshotQuery effectiveQuery = query == null ? new LoadDungeonSnapshotQuery() : query;
        return SnapshotPublication.snapshot(loadDungeonSnapshotUseCase.execute(
                MapPublication.domainId(effectiveQuery.mapId())));
    }

    public DungeonSurfacePayload loadSurface(LoadDungeonSurfaceQuery query) {
        LoadDungeonSurfaceQuery effectiveQuery = query == null
                ? new LoadDungeonSurfaceQuery(null, DungeonSurfaceKind.EDITOR)
                : query;
        LoadDungeonSnapshotUseCase.DungeonSnapshotData snapshot = loadDungeonSnapshotUseCase.execute(
                MapPublication.domainId(effectiveQuery.mapId()));
        DungeonInspectorSnapshot inspector = InspectorPublication.inspectorOrNull(effectiveQuery, loadDungeonSnapshotUseCase);
        return SurfacePublication.editor(
                snapshot,
                effectiveQuery.surfaceKind(),
                null,
                inspector,
                DungeonSurfaceMessages.empty());
    }

    public DungeonOperationResult applyOperation(ApplyDungeonEditorOperationCommand command) {
        DungeonEditorOperation operation = command == null ? null : command.operation();
        ApplyDungeonEditorOperationUseCase.OperationResultData result =
                applyDungeonEditorOperationUseCase.execute(
                        MapPublication.domainId(command == null ? null : command.mapId()),
                        OperationPublication.operationInput(operation));
        return new DungeonOperationResult(
                SnapshotPublication.snapshot(result.snapshot()),
                result.validationMessages(),
                result.reactionMessages());
    }

    public DungeonSnapshot previewOperation(PreviewDungeonEditorOperationQuery query) {
        DungeonEditorOperation operation = query == null ? null : query.operation();
        ApplyDungeonEditorOperationUseCase.OperationResultData result =
                applyDungeonEditorOperationUseCase.preview(
                        MapPublication.domainId(query == null ? null : query.mapId()),
                        OperationPublication.operationInput(operation));
        return SnapshotPublication.snapshot(result.snapshot());
    }

    public DungeonInspectorSnapshot describeSelection(DescribeDungeonSelectionQuery query) {
        DescribeDungeonSelectionQuery effectiveQuery = query == null
                ? new DescribeDungeonSelectionQuery(new DungeonMapId(1L), DungeonTopologyElementRef.empty(), 0L, false)
                : query;
        LoadDungeonSnapshotUseCase.InspectorSnapshotData snapshot =
                loadDungeonSnapshotUseCase.describeSelection(
                        MapPublication.domainId(effectiveQuery.mapId()),
                        MapPublication.domainTopologyRef(effectiveQuery.topologyRef()),
                        effectiveQuery.clusterId(),
                        effectiveQuery.clusterSelection());
        return new DungeonInspectorSnapshot(
                snapshot.title(),
                snapshot.description(),
                snapshot.facts(),
                snapshot.roomNarrations().stream().map(MapPublication::roomNarration).toList());
    }

    public DungeonSurfacePayload applySurfaceEdit(ApplyDungeonSurfaceEditCommand command) {
        DungeonSurfaceEdit edit = command == null ? null : command.edit();
        ApplyDungeonEditorOperationUseCase.OperationResultData result =
                applyDungeonEditorOperationUseCase.execute(
                        MapPublication.domainId(command == null ? null : command.mapId()),
                        OperationPublication.operationInput(edit == null ? null : edit.operation()));
        return SurfacePublication.editor(
                result.snapshot(),
                DungeonSurfaceKind.EDITOR,
                null,
                null,
                new DungeonSurfaceMessages(result.validationMessages(), result.reactionMessages()));
    }

    public DungeonSurfacePayload previewSurfaceEdit(PreviewDungeonSurfaceEditQuery query) {
        DungeonSurfaceEdit edit = query == null ? null : query.edit();
        DungeonMapIdentity mapId = MapPublication.domainId(query == null ? null : query.mapId());
        LoadDungeonSnapshotUseCase.DungeonSnapshotData baseSnapshot = loadDungeonSnapshotUseCase.execute(mapId);
        ApplyDungeonEditorOperationUseCase.OperationResultData preview =
                applyDungeonEditorOperationUseCase.preview(
                        mapId,
                        OperationPublication.operationInput(edit == null ? null : edit.operation()));
        DungeonMapSnapshot previewMap = MapPublication.snapshot(preview.snapshot().derived().map(), preview.snapshot().editorHandles());
        DungeonMapSnapshot safePreviewMap = previewMap.equals(MapPublication.snapshot(baseSnapshot.derived().map(), baseSnapshot.editorHandles()))
                ? null
                : previewMap;
        return SurfacePublication.editor(
                baseSnapshot,
                DungeonSurfaceKind.PREVIEW,
                safePreviewMap,
                null,
                new DungeonSurfaceMessages(preview.validationMessages(), preview.reactionMessages()));
    }

    public SearchMapsResult searchMaps(SearchMapsQuery query) {
        String searchTerm = query == null ? "" : query.query();
        List<DungeonMapSummary> maps = searchDungeonMapsUseCase.execute(searchTerm).stream()
                .map(MapPublication::summary)
                .toList();
        return new SearchMapsResult(maps);
    }

    public CreateDungeonMapResult createMap(CreateDungeonMapCommand command) {
        String mapName = command == null ? "" : command.mapName();
        CreateDungeonMapUseCase.CreatedMap result = createDungeonMapUseCase.execute(mapName);
        return new CreateDungeonMapResult(MapPublication.id(result.mapId()));
    }

    public RenameDungeonMapResult renameMap(RenameDungeonMapCommand command) {
        DungeonMapId mapId = command == null ? new DungeonMapId(1L) : command.mapId();
        String mapName = command == null ? "" : command.mapName();
        RenameDungeonMapUseCase.RenamedMap result = renameDungeonMapUseCase.execute(
                MapPublication.domainId(mapId),
                mapName);
        return new RenameDungeonMapResult(MapPublication.id(result.mapId()));
    }

    public DeleteDungeonMapResult deleteMap(DeleteDungeonMapCommand command) {
        DungeonMapId mapId = command == null ? new DungeonMapId(1L) : command.mapId();
        return new DeleteDungeonMapResult(MapPublication.id(
                deleteDungeonMapUseCase.execute(MapPublication.domainId(mapId))));
    }

    public BaseMapSnapshot loadMapSnapshot(LoadMapSnapshotQuery query) {
        LoadMapSnapshotQuery effectiveQuery = query == null
                ? new LoadMapSnapshotQuery(new DungeonMapId(1L), 0)
                : query;
        LoadMapSnapshotUseCase.MapSnapshotData snapshot = loadMapSnapshotUseCase.execute(
                MapPublication.domainId(effectiveQuery.mapId()),
                effectiveQuery.targetFloor());
        return new BaseMapSnapshot(
                MapPublication.id(snapshot.mapId()),
                snapshot.mapName(),
                snapshot.revision(),
                snapshot.targetFloor(),
                    MapPublication.snapshot(snapshot.map()),
                snapshot.empty());
    }

    public DungeonTravelSurfaceSnapshot loadTravelSurface(LoadDungeonTravelSurfaceQuery query) {
        LoadDungeonTravelSurfaceQuery effectiveQuery = query == null
                ? new LoadDungeonTravelSurfaceQuery(null)
                : query;
        return TravelPublication.surface(loadRawTravelSurface(effectiveQuery.position()), DungeonTravelContextKind.DUNGEON);
    }

    public DungeonTravelMoveResult moveTravelAction(MoveDungeonTravelActionCommand command) {
        MoveDungeonTravelActionCommand effectiveCommand = command == null
                ? new MoveDungeonTravelActionCommand(null, "")
                : command;
        DungeonTravelMoveFacts result = moveDungeonTravelActionUseCase.execute(new MoveDungeonTravelActionUseCase.Input(
                TravelPublication.position(effectiveCommand.position()),
                effectiveCommand.actionId()));
        return TravelPublication.moveResult(result);
    }

    private DungeonEditorSnapshot currentEditorSnapshot() {
        return applyDungeonEditorSessionUseCase.snapshot();
    }

    private Runnable subscribeEditorListener(Consumer<DungeonEditorSnapshot> listener) {
        Consumer<DungeonEditorSnapshot> safeListener = Objects.requireNonNull(listener, "listener");
        editorListeners.add(safeListener);
        return () -> editorListeners.remove(safeListener);
    }

    private void notifyEditorListeners(DungeonEditorSnapshot snapshot) {
        List<Consumer<DungeonEditorSnapshot>> listeners = List.copyOf(editorListeners);
        for (Consumer<DungeonEditorSnapshot> listener : listeners) {
            listener.accept(snapshot);
        }
    }

    private DungeonTravelSurfaceFacts loadRawTravelSurface(@Nullable DungeonTravelPosition position) {
        return loadDungeonTravelSurfaceUseCase.execute(
                new LoadDungeonTravelSurfaceUseCase.Input(TravelPublication.position(position)));
    }

    private static final class SnapshotPublication {

        private SnapshotPublication() {
        }

        private static DungeonSnapshot snapshot(LoadDungeonSnapshotUseCase.DungeonSnapshotData snapshot) {
            return new DungeonSnapshot(
                    snapshot.mapName(),
                    DungeonMapMode.EDITOR,
                    MapPublication.snapshot(snapshot.derived().map(), snapshot.editorHandles()),
                    snapshot.derived().aggregates().stream().map(SnapshotPublication::aggregateSummary).toList(),
                    snapshot.derived().relations().summaries(),
                    MapPublication.revision(snapshot.revision()));
        }

        private static String aggregateSummary(DungeonAggregate aggregate) {
            return aggregate.label() + " #" + aggregate.id();
        }
    }

    private static final class InspectorPublication {

        private InspectorPublication() {
        }

        private static @Nullable DungeonInspectorSnapshot inspectorOrNull(
                LoadDungeonSurfaceQuery query,
                LoadDungeonSnapshotUseCase loadDungeonSnapshotUseCase
        ) {
            if (query == null) {
                return null;
            }
            boolean hasSelection = query.clusterId() > 0L || query.topologyRef().id() > 0L;
            if (!hasSelection) {
                return null;
            }
            LoadDungeonSnapshotUseCase.InspectorSnapshotData snapshot =
                    loadDungeonSnapshotUseCase.describeSelection(
                            MapPublication.domainId(query.mapId()),
                            MapPublication.domainTopologyRef(query.topologyRef()),
                            query.clusterId(),
                            query.clusterSelection());
            return new DungeonInspectorSnapshot(
                    snapshot.title(),
                    snapshot.description(),
                    snapshot.facts(),
                    snapshot.roomNarrations().stream().map(MapPublication::roomNarration).toList());
        }
    }

    private static final class SurfacePublication {

        private SurfacePublication() {
        }

        private static DungeonSurfacePayload editor(
                LoadDungeonSnapshotUseCase.DungeonSnapshotData snapshot,
                DungeonSurfaceKind surfaceKind,
                @Nullable DungeonMapSnapshot previewMap,
                @Nullable DungeonInspectorSnapshot inspector,
                DungeonSurfaceMessages messages
        ) {
            DungeonSnapshot committed = SnapshotPublication.snapshot(snapshot);
            return new DungeonSurfacePayload(
                    committed.mapName(),
                    surfaceKind,
                    committed.mode(),
                    committed.revision(),
                    committed.map(),
                    previewMap,
                    committed.aggregateSummaries(),
                    committed.relationSummaries(),
                    inspector,
                    null,
                    messages);
        }

    }

    private static final class OperationPublication {

        private OperationPublication() {
        }

        private static ApplyDungeonEditorOperationUseCase.OperationInput operationInput(
                @Nullable DungeonEditorOperation operation
        ) {
            if (operation instanceof DungeonEditorOperation.MoveTopologyElement moveTopologyElement) {
                return new ApplyDungeonEditorOperationUseCase.OperationInput.MoveTopologyElement(
                        MapPublication.domainTopologyRef(moveTopologyElement.ref()),
                        moveTopologyElement.deltaQ(),
                        moveTopologyElement.deltaR(),
                        moveTopologyElement.deltaLevel());
            }
            if (operation instanceof DungeonEditorOperation.MoveEditorHandle moveEditorHandle) {
                return new ApplyDungeonEditorOperationUseCase.OperationInput.MoveEditorHandle(
                        MapPublication.domainHandle(moveEditorHandle.ref()),
                        moveEditorHandle.deltaQ(),
                        moveEditorHandle.deltaR(),
                        moveEditorHandle.deltaLevel());
            }
            if (operation instanceof DungeonEditorOperation.MoveBoundaryStretch moveBoundaryStretch) {
                return new ApplyDungeonEditorOperationUseCase.OperationInput.MoveBoundaryStretch(
                        moveBoundaryStretch.clusterId(),
                        moveBoundaryStretch.sourceEdges().stream().map(MapPublication::domainEdge).toList(),
                        moveBoundaryStretch.deltaQ(),
                        moveBoundaryStretch.deltaR(),
                        moveBoundaryStretch.deltaLevel());
            }
            if (operation instanceof DungeonEditorOperation.MoveRoomAnchor moveRoomAnchor) {
                return new ApplyDungeonEditorOperationUseCase.OperationInput.MoveRoomAnchor(
                        moveRoomAnchor.deltaQ(),
                        moveRoomAnchor.deltaR());
            }
            if (operation instanceof DungeonEditorOperation.PaintRoomRectangle paintRoomRectangle) {
                return new ApplyDungeonEditorOperationUseCase.OperationInput.PaintRoomRectangle(
                        MapPublication.domainCell(paintRoomRectangle.start()),
                        MapPublication.domainCell(paintRoomRectangle.end()));
            }
            if (operation instanceof DungeonEditorOperation.DeleteRoomRectangle deleteRoomRectangle) {
                return new ApplyDungeonEditorOperationUseCase.OperationInput.DeleteRoomRectangle(
                        MapPublication.domainCell(deleteRoomRectangle.start()),
                        MapPublication.domainCell(deleteRoomRectangle.end()));
            }
            if (operation instanceof DungeonEditorOperation.EditClusterBoundaries editClusterBoundaries) {
                return new ApplyDungeonEditorOperationUseCase.OperationInput.EditClusterBoundaries(
                        editClusterBoundaries.clusterId(),
                        editClusterBoundaries.edges().stream().map(MapPublication::domainEdge).toList(),
                        MapPublication.domainBoundaryKind(editClusterBoundaries.kind()),
                        editClusterBoundaries.deleteBoundary());
            }
            if (operation instanceof DungeonEditorOperation.CreateCorridor createCorridor) {
                return new ApplyDungeonEditorOperationUseCase.OperationInput.CreateCorridor(
                        corridorEndpoint(createCorridor.start()),
                        corridorEndpoint(createCorridor.end()));
            }
            if (operation instanceof DungeonEditorOperation.ExtendCorridor extendCorridor) {
                return new ApplyDungeonEditorOperationUseCase.OperationInput.ExtendCorridor(
                        extendCorridor.corridorId(),
                        corridorRoomEndpoint(extendCorridor.endpoint()));
            }
            if (operation instanceof DungeonEditorOperation.MergeCorridors mergeCorridors) {
                return new ApplyDungeonEditorOperationUseCase.OperationInput.MergeCorridors(
                        mergeCorridors.corridorId(),
                        mergeCorridors.mergedCorridorId());
            }
            if (operation instanceof DungeonEditorOperation.DeleteCorridor deleteCorridor) {
                return new ApplyDungeonEditorOperationUseCase.OperationInput.DeleteCorridor(deleteCorridor.corridorId());
            }
            if (operation instanceof DungeonEditorOperation.SaveRoomNarration saveRoomNarration) {
                return new ApplyDungeonEditorOperationUseCase.OperationInput.SaveRoomNarration(
                        saveRoomNarration.roomId(),
                        saveRoomNarration.visualDescription(),
                        saveRoomNarration.exits().stream().map(MapPublication::domainExitNarration).toList());
            }
            return new ApplyDungeonEditorOperationUseCase.OperationInput.NoChange();
        }

        private static ApplyDungeonEditorOperationUseCase.OperationInput.CorridorEndpoint corridorEndpoint(
                DungeonEditorOperation.CorridorEndpoint endpoint
        ) {
            if (endpoint instanceof DungeonEditorOperation.CorridorDoorEndpoint doorEndpoint) {
                return new ApplyDungeonEditorOperationUseCase.OperationInput.CorridorDoorEndpoint(
                        doorEndpoint.roomId(),
                        doorEndpoint.clusterId(),
                        MapPublication.domainCell(doorEndpoint.roomCell()),
                        doorEndpoint.direction().isBlank()
                                ? DungeonEdgeDirection.NORTH
                                : DungeonEdgeDirection.parse(doorEndpoint.direction()),
                        MapPublication.domainTopologyRef(doorEndpoint.topologyRef()));
            }
            if (endpoint instanceof DungeonEditorOperation.CorridorAnchorEndpoint anchorEndpoint) {
                return new ApplyDungeonEditorOperationUseCase.OperationInput.CorridorAnchorEndpoint(
                        anchorEndpoint.hostCorridorId(),
                        MapPublication.domainCell(anchorEndpoint.anchorCell()),
                        MapPublication.domainTopologyRef(anchorEndpoint.topologyRef()));
            }
            return new ApplyDungeonEditorOperationUseCase.OperationInput.CorridorDoorEndpoint(
                    0L,
                    0L,
                    new DungeonCell(0, 0, 0),
                    DungeonEdgeDirection.NORTH,
                    DungeonTopologyRef.empty());
        }

        private static ApplyDungeonEditorOperationUseCase.OperationInput.CorridorRoomEndpoint corridorRoomEndpoint(
                DungeonEditorOperation.CorridorRoomEndpoint endpoint
        ) {
            if (endpoint == null) {
                return new ApplyDungeonEditorOperationUseCase.OperationInput.CorridorRoomEndpoint(
                        0L,
                        0L,
                        false,
                        new DungeonCell(0, 0, 0),
                        DungeonEdgeDirection.NORTH,
                        DungeonTopologyRef.empty());
            }
            return new ApplyDungeonEditorOperationUseCase.OperationInput.CorridorRoomEndpoint(
                    endpoint.roomId(),
                    endpoint.clusterId(),
                    endpoint.fixedDoor(),
                    MapPublication.domainCell(endpoint.roomCell()),
                    endpoint.direction().isBlank()
                            ? DungeonEdgeDirection.NORTH
                            : DungeonEdgeDirection.parse(endpoint.direction()),
                    MapPublication.domainTopologyRef(endpoint.topologyRef()));
        }
    }

    private static final class MapPublication {

        private MapPublication() {
        }

        private static DungeonMapSummary summary(SearchDungeonMapsUseCase.MapSummary summary) {
            return new DungeonMapSummary(id(summary.mapId()), summary.mapName(), summary.revision());
        }

        private static DungeonMapSnapshot snapshot(DungeonMapFacts facts) {
            return snapshot(facts, List.of());
        }

        private static DungeonMapSnapshot snapshot(DungeonMapFacts facts, List<DungeonEditorHandleFacts> handles) {
            DungeonMapFacts safeFacts = facts == null
                    ? new DungeonMapFacts(DungeonTopology.SQUARE, 1, 1, List.of(), List.of())
                    : facts;
            return new DungeonMapSnapshot(
                    topology(safeFacts.topology()),
                    safeFacts.width(),
                    safeFacts.height(),
                    safeFacts.areas().stream().map(MapPublication::area).toList(),
                    safeFacts.boundaries().stream().map(MapPublication::boundary).toList(),
                    safeFacts.features().stream().map(MapPublication::feature).toList(),
                    handles == null ? List.of() : handles.stream().map(MapPublication::handle).toList());
        }

        private static DungeonMapId id(DungeonMapIdentity identity) {
            return new DungeonMapId(identity == null ? 1L : identity.value());
        }

        private static DungeonMapIdentity domainId(@Nullable DungeonMapId mapId) {
            return new DungeonMapIdentity(mapId == null ? 1L : mapId.value());
        }

        private static DungeonAreaSnapshot area(DungeonAreaFacts area) {
            return new DungeonAreaSnapshot(
                    areaKind(area.kind()),
                    area.id(),
                    area.clusterId(),
                    area.label(),
                    area.cells().stream().map(MapPublication::cell).toList(),
                    topologyRef(area.topologyRef()));
        }

        private static DungeonBoundarySnapshot boundary(DungeonBoundaryFacts boundary) {
            return new DungeonBoundarySnapshot(
                    boundary.kind(),
                    boundary.id(),
                    boundary.label(),
                    edge(boundary.edge()),
                    topologyRef(boundary.topologyRef()));
        }

        private static DungeonFeatureSnapshot feature(DungeonFeatureFacts feature) {
            return new DungeonFeatureSnapshot(
                    DungeonFeatureKind.valueOf(feature.kind().name()),
                    feature.id(),
                    feature.label(),
                    feature.cells().stream().map(MapPublication::cell).toList(),
                    feature.description(),
                    feature.destinationLabel(),
                    topologyRef(feature.topologyRef()));
        }

        private static DungeonEditorHandleSnapshot handle(DungeonEditorHandleFacts handle) {
            return new DungeonEditorHandleSnapshot(
                    handleRef(handle.handle()),
                    handle.label(),
                    cell(handle.handle().cell()));
        }

        private static DungeonEditorHandleRef handleRef(DungeonEditorHandle handle) {
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

        private static DungeonInspectorSnapshot.RoomNarrationCard roomNarration(
                LoadDungeonSnapshotUseCase.RoomNarrationData roomNarration
        ) {
            return new DungeonInspectorSnapshot.RoomNarrationCard(
                    roomNarration.roomId(),
                    roomNarration.roomName(),
                    roomNarration.visualDescription(),
                    roomNarration.exits().stream().map(MapPublication::exitNarration).toList());
        }

        private static DungeonInspectorSnapshot.RoomExitNarration exitNarration(
                LoadDungeonSnapshotUseCase.RoomExitNarrationData exitNarration
        ) {
            return new DungeonInspectorSnapshot.RoomExitNarration(
                    exitNarration.label(),
                    cell(exitNarration.cell()),
                    exitNarration.direction().name(),
                    exitNarration.description());
        }

        private static DungeonRoomExitDescription domainExitNarration(
                DungeonInspectorSnapshot.RoomExitNarration exitNarration
        ) {
            return new DungeonRoomExitDescription(
                    domainCell(exitNarration.cell()),
                    src.domain.dungeon.map.value.DungeonEdgeDirection.parse(exitNarration.direction()),
                    exitNarration.description());
        }

        private static DungeonAreaKind areaKind(DungeonAreaType kind) {
            return kind == DungeonAreaType.CORRIDOR ? DungeonAreaKind.CORRIDOR : DungeonAreaKind.ROOM;
        }

        private static DungeonTopologyKind topology(DungeonTopology topology) {
            return topology == DungeonTopology.HEX ? DungeonTopologyKind.HEX : DungeonTopologyKind.SQUARE;
        }

        private static DungeonTopologyElementRef topologyRef(DungeonTopologyRef ref) {
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
                        new DungeonCell(0, 0, 0),
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
                    ref.direction().isBlank() ? DungeonEdgeDirection.NORTH : DungeonEdgeDirection.parse(ref.direction()));
        }

        private static DungeonCellRef cell(DungeonCell cell) {
            return new DungeonCellRef(cell.q(), cell.r(), cell.level());
        }

        private static DungeonCell domainCell(DungeonCellRef cell) {
            return cell == null ? new DungeonCell(0, 0, 0) : new DungeonCell(cell.q(), cell.r(), cell.level());
        }

        private static DungeonEdge domainEdge(DungeonEdgeRef edge) {
            if (edge == null) {
                DungeonCell origin = new DungeonCell(0, 0, 0);
                return new DungeonEdge(origin, origin);
            }
            return new DungeonEdge(domainCell(edge.from()), domainCell(edge.to()));
        }

        private static DungeonEdgeRef edge(DungeonEdge edge) {
            return new DungeonEdgeRef(cell(edge.from()), cell(edge.to()));
        }

        private static DungeonClusterBoundaryKind domainBoundaryKind(DungeonBoundaryKind kind) {
            return kind == DungeonBoundaryKind.DOOR
                    ? DungeonClusterBoundaryKind.DOOR
                    : DungeonClusterBoundaryKind.WALL;
        }

        private static int revision(long revision) {
            if (revision > Integer.MAX_VALUE) {
                return Integer.MAX_VALUE;
            }
            return Math.max(0, (int) revision);
        }
    }

    private static final class TravelPublication {

        private TravelPublication() {
        }

        private static DungeonTravelMoveResult moveResult(DungeonTravelMoveFacts result) {
            return new DungeonTravelMoveResult(
                    DungeonTravelMoveStatus.valueOf(result.status().name()),
                    result.message(),
                    surface(result.surface(), DungeonTravelContextKind.DUNGEON),
                    externalTarget(result.externalTarget()));
        }

        private static @Nullable DungeonTravelExternalTarget externalTarget(
                @Nullable DungeonTravelExternalTargetFacts externalTarget
        ) {
            if (externalTarget instanceof DungeonTravelExternalTargetFacts.OverworldTile overworld) {
                return new DungeonTravelExternalTarget.OverworldTile(overworld.mapId(), overworld.tileId());
            }
            return null;
        }

        private static DungeonTravelSurfaceSnapshot surface(
                DungeonTravelSurfaceFacts surface,
                DungeonTravelContextKind contextKind
        ) {
            return new DungeonTravelSurfaceSnapshot(
                    contextKind,
                    surface.mapName(),
                    MapPublication.revision(surface.revision()),
                    MapPublication.snapshot(surface.map()),
                    position(surface.position()),
                    surface.surfaceTitle(),
                    surface.areaLabel(),
                    surface.tileLabel(),
                    surface.headingLabel(),
                    surface.statusLabel(),
                    surface.visualDescription(),
                    surface.actions().stream().map(TravelPublication::action).toList());
        }

        private static DungeonTravelActionSnapshot action(DungeonTravelActionFacts action) {
            return new DungeonTravelActionSnapshot(
                    action.actionId(),
                    DungeonTravelActionKind.valueOf(action.kind().name()),
                    action.label(),
                    action.destinationLabel(),
                    action.description());
        }

        private static DungeonTravelPosition position(DungeonTravelPositionFacts position) {
            return new DungeonTravelPosition(
                    MapPublication.id(position.mapId()),
                    DungeonTravelLocationKind.valueOf(position.locationKind().name()),
                    position.ownerId(),
                    MapPublication.cell(position.tile()),
                    DungeonTravelHeading.valueOf(position.heading().name()));
        }

        private static @Nullable DungeonTravelPositionFacts position(@Nullable DungeonTravelPosition position) {
            if (position == null) {
                return null;
            }
            return new DungeonTravelPositionFacts(
                    MapPublication.domainId(position.mapId()),
                    src.domain.dungeon.map.value.DungeonTravelLocationKind.valueOf(position.locationKind().name()),
                    position.ownerId(),
                    MapPublication.domainCell(position.tile()),
                    src.domain.dungeon.map.value.DungeonTravelHeading.valueOf(position.heading().name()));
        }
    }

}


final class BuildDungeonEditorSnapshotUseCase {

    public record State(
            @Nullable DungeonMapId selectedMapId,
            String viewModeKey,
            String selectedTool,
            int projectionLevel,
            DungeonOverlaySettings overlaySettings,
            DungeonEditorSnapshot.Selection selection,
            @Nullable DungeonEditorOperation previewOperation,
            String statusText
    ) {
        public State {
            viewModeKey = viewModeKey == null || viewModeKey.isBlank() ? "GRID" : viewModeKey;
            selectedTool = selectedTool == null || selectedTool.isBlank() ? "Auswahl" : selectedTool;
            overlaySettings = overlaySettings == null ? DungeonOverlaySettings.defaults() : overlaySettings;
            selection = selection == null ? DungeonEditorSnapshot.Selection.empty() : selection;
            statusText = statusText == null ? "" : statusText;
        }
    }

    private final Function<SearchMapsQuery, SearchMapsResult> searchMaps;
    private final Function<LoadDungeonSurfaceQuery, DungeonSurfacePayload> loadSurface;
    private final Function<PreviewDungeonSurfaceEditQuery, DungeonSurfacePayload> previewSurfaceEdit;
    private final Function<DescribeDungeonSelectionQuery, DungeonInspectorSnapshot> describeSelection;
    private final Function<LoadDungeonSnapshotQuery, DungeonSnapshot> loadSnapshot;

    public BuildDungeonEditorSnapshotUseCase(
            Function<SearchMapsQuery, SearchMapsResult> searchMaps,
            Function<LoadDungeonSurfaceQuery, DungeonSurfacePayload> loadSurface,
            Function<PreviewDungeonSurfaceEditQuery, DungeonSurfacePayload> previewSurfaceEdit,
            Function<DescribeDungeonSelectionQuery, DungeonInspectorSnapshot> describeSelection,
            Function<LoadDungeonSnapshotQuery, DungeonSnapshot> loadSnapshot
    ) {
        this.searchMaps = searchMaps;
        this.loadSurface = loadSurface;
        this.previewSurfaceEdit = previewSurfaceEdit;
        this.describeSelection = describeSelection;
        this.loadSnapshot = loadSnapshot;
    }

    public DungeonEditorSnapshot execute(State state) {
        State safeState = state == null
                ? new State(null, "GRID", "Auswahl", 0, DungeonOverlaySettings.defaults(),
                DungeonEditorSnapshot.Selection.empty(), null, "")
                : state;
        SearchMapsResult mapsResult = searchMaps.apply(new SearchMapsQuery(""));
        List<DungeonMapSummary> maps = mapsResult == null ? List.of() : mapsResult.maps();
        DungeonMapId resolvedMapId = resolveSelectedMapId(safeState.selectedMapId(), maps);
        DungeonSurfacePayload surface = loadCurrentSurface(resolvedMapId, safeState.selection(), safeState.previewOperation());
        int clampedProjectionLevel = clampProjectionLevel(surface, safeState.projectionLevel());
        String nextStatus = safeState.statusText().isBlank()
                ? statusFromMessages(surface == null ? null : surface.messages())
                : safeState.statusText();
        return new DungeonEditorSnapshot(
                maps,
                resolvedMapId,
                safeState.viewModeKey(),
                safeState.selectedTool(),
                clampedProjectionLevel,
                safeState.overlaySettings(),
                safeState.selection(),
                surface,
                toPreview(safeState.previewOperation()),
                nextStatus);
    }

    public @Nullable DungeonSnapshot loadCommittedSnapshot(@Nullable DungeonMapId mapId) {
        if (mapId == null) {
            return null;
        }
        return loadSnapshot.apply(new LoadDungeonSnapshotQuery(mapId));
    }

    private @Nullable DungeonSurfacePayload loadCurrentSurface(
            @Nullable DungeonMapId mapId,
            DungeonEditorSnapshot.Selection selection,
            @Nullable DungeonEditorOperation previewOperation
    ) {
        if (mapId == null) {
            return null;
        }
        if (previewOperation != null) {
            DungeonSurfacePayload previewSurface = previewSurfaceEdit.apply(new PreviewDungeonSurfaceEditQuery(
                    mapId,
                    new DungeonSurfaceEdit(previewOperation)));
            return withInspector(mapId, selection, previewSurface);
        }
        if (!selection.topologyRef().equals(DungeonTopologyElementRef.empty()) || selection.clusterSelection()) {
            return loadSurface.apply(new LoadDungeonSurfaceQuery(
                    mapId,
                    DungeonSurfaceKind.EDITOR,
                    selection.topologyRef(),
                    selection.clusterId(),
                    selection.clusterSelection()));
        }
        return loadSurface.apply(new LoadDungeonSurfaceQuery(mapId, DungeonSurfaceKind.EDITOR));
    }

    private @Nullable DungeonSurfacePayload withInspector(
            DungeonMapId mapId,
            DungeonEditorSnapshot.Selection selection,
            @Nullable DungeonSurfacePayload surface
    ) {
        if (surface == null) {
            return null;
        }
        if (selection.topologyRef().equals(DungeonTopologyElementRef.empty()) && !selection.clusterSelection()) {
            return surface;
        }
        DungeonInspectorSnapshot inspector = describeSelection.apply(new DescribeDungeonSelectionQuery(
                mapId,
                selection.topologyRef(),
                selection.clusterId(),
                selection.clusterSelection()));
        return new DungeonSurfacePayload(
                surface.mapName(),
                surface.surfaceKind(),
                surface.mode(),
                surface.revision(),
                surface.map(),
                surface.previewMap(),
                surface.aggregateSummaries(),
                surface.relationSummaries(),
                inspector,
                surface.travel(),
                surface.messages());
    }

    private static @Nullable DungeonMapId resolveSelectedMapId(
            @Nullable DungeonMapId requestedMapId,
            List<DungeonMapSummary> maps
    ) {
        if (requestedMapId != null && maps.stream().anyMatch(summary -> requestedMapId.equals(summary.mapId()))) {
            return requestedMapId;
        }
        return maps.isEmpty() ? null : maps.getFirst().mapId();
    }

    private static DungeonEditorPreview toPreview(@Nullable DungeonEditorOperation operation) {
        if (operation == null) {
            return DungeonEditorPreview.none();
        }
        return switch (operation) {
            case DungeonEditorOperation.PaintRoomRectangle room ->
                    new DungeonEditorPreview.RoomRectanglePreview(room.start(), room.end(), false);
            case DungeonEditorOperation.DeleteRoomRectangle room ->
                    new DungeonEditorPreview.RoomRectanglePreview(room.start(), room.end(), true);
            case DungeonEditorOperation.EditClusterBoundaries boundaries ->
                    new DungeonEditorPreview.ClusterBoundariesPreview(
                            boundaries.clusterId(),
                            boundaries.edges(),
                            boundaries.kind(),
                            boundaries.deleteBoundary());
            case DungeonEditorOperation.MoveEditorHandle moveHandle ->
                    new DungeonEditorPreview.MoveHandlePreview(
                            moveHandle.ref(),
                            moveHandle.deltaQ(),
                            moveHandle.deltaR(),
                            moveHandle.deltaLevel());
            case DungeonEditorOperation.MoveBoundaryStretch stretch ->
                    new DungeonEditorPreview.MoveBoundaryStretchPreview(
                            stretch.clusterId(),
                            stretch.sourceEdges(),
                            stretch.deltaQ(),
                            stretch.deltaR(),
                            stretch.deltaLevel());
            case DungeonEditorOperation.CreateCorridor ignoredCreateCorridor -> DungeonEditorPreview.none();
            case DungeonEditorOperation.ExtendCorridor ignoredExtendCorridor -> DungeonEditorPreview.none();
            case DungeonEditorOperation.MergeCorridors ignoredMergeCorridors -> DungeonEditorPreview.none();
            case DungeonEditorOperation.DeleteCorridor ignoredDeleteCorridor -> DungeonEditorPreview.none();
            case DungeonEditorOperation.MoveTopologyElement ignoredMoveTopology -> DungeonEditorPreview.none();
            case DungeonEditorOperation.MoveRoomAnchor ignoredMoveRoomAnchor -> DungeonEditorPreview.none();
            case DungeonEditorOperation.SaveRoomNarration ignoredSaveRoomNarration ->
                    DungeonEditorPreview.none();
        };
    }

    private static int clampProjectionLevel(@Nullable DungeonSurfacePayload surface, int projectionLevel) {
        List<Integer> levels = surface == null
                ? List.of(projectionLevel)
                : surface.reachableLevels(projectionLevel);
        if (levels.isEmpty()) {
            return projectionLevel;
        }
        return Math.max(levels.getFirst(), Math.min(levels.getLast(), projectionLevel));
    }

    private static String statusFromMessages(@Nullable DungeonSurfaceMessages messages) {
        if (messages == null) {
            return "";
        }
        if (!messages.reactionMessages().isEmpty()) {
            return messages.reactionMessages().getFirst();
        }
        if (!messages.validationMessages().isEmpty()) {
            return messages.validationMessages().getFirst();
        }
        return "";
    }
}


final class ApplyDungeonEditorSessionUseCase {

    private static final String DEFAULT_VIEW_MODE = "GRID";
    private static final String DEFAULT_TOOL = "Auswahl";

    private final Function<CreateDungeonMapCommand, CreateDungeonMapResult> createMap;
    private final Function<RenameDungeonMapCommand, RenameDungeonMapResult> renameMap;
    private final Function<DeleteDungeonMapCommand, DeleteDungeonMapResult> deleteMap;
    private final Consumer<ApplyDungeonSurfaceEditCommand> applySurfaceEdit;
    private final BuildDungeonEditorSnapshotUseCase snapshotBuilder;
    private final InterpretDungeonEditorMainViewInputUseCase mainViewInterpreter =
            new InterpretDungeonEditorMainViewInputUseCase();

    private @Nullable DungeonMapId selectedMapId;
    private String viewModeKey = DEFAULT_VIEW_MODE;
    private String selectedTool = DEFAULT_TOOL;
    private int projectionLevel;
    private DungeonOverlaySettings overlaySettings = DungeonOverlaySettings.defaults();
    private DungeonEditorSnapshot.Selection selection = DungeonEditorSnapshot.Selection.empty();
    private @Nullable DungeonEditorOperation previewOperation;
    private String statusText = "";

    public ApplyDungeonEditorSessionUseCase(
            Function<CreateDungeonMapCommand, CreateDungeonMapResult> createMap,
            Function<RenameDungeonMapCommand, RenameDungeonMapResult> renameMap,
            Function<DeleteDungeonMapCommand, DeleteDungeonMapResult> deleteMap,
            Consumer<ApplyDungeonSurfaceEditCommand> applySurfaceEdit,
            BuildDungeonEditorSnapshotUseCase snapshotBuilder
    ) {
        this.createMap = createMap;
        this.renameMap = renameMap;
        this.deleteMap = deleteMap;
        this.applySurfaceEdit = applySurfaceEdit;
        this.snapshotBuilder = snapshotBuilder;
    }

    public void primeSelectedMap(@Nullable DungeonMapId mapId) {
        if (selectedMapId == null && mapId != null) {
            selectedMapId = mapId;
        }
    }

    public void apply(@Nullable ApplyDungeonEditorSessionCommand command) {
        if (command == null) {
            return;
        }
        switch (command.action()) {
            case SELECT_MAP -> selectMap(command);
            case CREATE_MAP -> createSelectedMap(command);
            case RENAME_MAP -> renameSelectedMap(command);
            case DELETE_MAP -> deleteSelectedMap(command);
            case SET_VIEW_MODE -> setViewMode(command);
            case SET_TOOL -> setTool(command);
            case SHIFT_PROJECTION_LEVEL -> shiftProjectionLevel(command);
            case SET_OVERLAY -> setOverlay(command);
            case INTERPRET_MAIN_VIEW -> applyMainViewInput(command.mainViewInput());
            case SAVE_ROOM_NARRATION -> applyRoomNarration(command.roomNarration());
        }
    }

    public DungeonEditorSnapshot snapshot() {
        DungeonEditorSnapshot snapshot = snapshotBuilder.execute(new BuildDungeonEditorSnapshotUseCase.State(
                selectedMapId,
                viewModeKey,
                selectedTool,
                projectionLevel,
                overlaySettings,
                selection,
                previewOperation,
                statusText));
        selectedMapId = snapshot.selectedMapId();
        projectionLevel = snapshot.projectionLevel();
        return snapshot;
    }

    private void clearTransientState(String nextStatusText) {
        previewOperation = null;
        statusText = nextStatusText == null ? "" : nextStatusText;
        mainViewInterpreter.clear();
    }

    private void selectMap(ApplyDungeonEditorSessionCommand command) {
        selectedMapId = command.mapId();
        selection = DungeonEditorSnapshot.Selection.empty();
        clearTransientState("");
    }

    private void createSelectedMap(ApplyDungeonEditorSessionCommand command) {
        selectedMapId = createMap.apply(new CreateDungeonMapCommand(command.mapName())).mapId();
        selection = DungeonEditorSnapshot.Selection.empty();
        clearTransientState("Dungeon-Map erstellt.");
    }

    private void renameSelectedMap(ApplyDungeonEditorSessionCommand command) {
        selectedMapId = renameMap.apply(new RenameDungeonMapCommand(
                requireMapId(command.mapId()),
                command.mapName())).mapId();
        statusText = "Dungeon-Map umbenannt.";
    }

    private void deleteSelectedMap(ApplyDungeonEditorSessionCommand command) {
        DungeonMapId deletedMapId = deleteMap.apply(new DeleteDungeonMapCommand(requireMapId(command.mapId()))).mapId();
        if (deletedMapId != null && deletedMapId.equals(selectedMapId)) {
            selectedMapId = null;
        }
        selection = DungeonEditorSnapshot.Selection.empty();
        clearTransientState("Dungeon-Map geloescht.");
    }

    private void setViewMode(ApplyDungeonEditorSessionCommand command) {
        viewModeKey = normalizeViewMode(command.viewModeKey());
        clearTransientState("");
    }

    private void setTool(ApplyDungeonEditorSessionCommand command) {
        selectedTool = normalizeTool(command.selectedTool());
        clearTransientState("");
    }

    private void shiftProjectionLevel(ApplyDungeonEditorSessionCommand command) {
        projectionLevel += command.projectionLevelDelta();
        statusText = "";
    }

    private void setOverlay(ApplyDungeonEditorSessionCommand command) {
        overlaySettings = command.overlaySettings();
        statusText = "";
    }

    private void applyRoomNarration(ApplyDungeonEditorSessionCommand.RoomNarrationInput roomNarration) {
        if (roomNarration == null || roomNarration.roomId() <= 0L) {
            return;
        }
        applySurfaceEdit.accept(new ApplyDungeonSurfaceEditCommand(
                requireMapId(selectedMapId),
                new DungeonSurfaceEdit(new DungeonEditorOperation.SaveRoomNarration(
                        roomNarration.roomId(),
                        roomNarration.visualDescription(),
                        roomNarration.exits()))));
        previewOperation = null;
        statusText = "Raumbeschreibung gespeichert.";
    }

    private void applyMainViewInput(ApplyDungeonEditorSessionCommand.MainViewInput mainViewInput) {
        ApplyDungeonEditorSessionCommand.MainViewInput input = mainViewInput == null
                ? ApplyDungeonEditorSessionCommand.MainViewInput.empty()
                : mainViewInput;
        DungeonSnapshot committedSnapshot = snapshotBuilder.loadCommittedSnapshot(selectedMapId);
        if (input.source() == ApplyDungeonEditorSessionCommand.MainViewInput.Source.LEVEL_SCROLLED) {
            applyInteractionEffect(mainViewInterpreter.consume(
                    input,
                    committedSnapshot,
                    selection,
                    selectedTool,
                    viewModeKey,
                    projectionLevel));
            return;
        }
        if (selectedMapId == null || committedSnapshot == null || !"GRID".equalsIgnoreCase(viewModeKey)) {
            return;
        }
        applyInteractionEffect(mainViewInterpreter.consume(
                input,
                committedSnapshot,
                selection,
                selectedTool,
                viewModeKey,
                projectionLevel));
    }

    private void applyInteractionEffect(InterpretDungeonEditorMainViewInputUseCase.Effect effect) {
        if (effect == null) {
            return;
        }
        if (effect.projectionLevelDelta() != 0) {
            projectionLevel += effect.projectionLevelDelta();
        }
        if (effect.statusText() != null) {
            statusText = effect.statusText();
        }
        if (effect.clearSelection()) {
            selection = DungeonEditorSnapshot.Selection.empty();
            previewOperation = null;
        } else if (effect.selection() != null) {
            selection = effect.selection();
            previewOperation = null;
        }
        if (effect.clearPreview()) {
            previewOperation = null;
        } else if (effect.previewOperation() != null) {
            previewOperation = effect.previewOperation();
            statusText = "";
        }
        if (effect.applyOperation() != null) {
            applySurfaceEdit.accept(new ApplyDungeonSurfaceEditCommand(
                    requireMapId(selectedMapId),
                    new DungeonSurfaceEdit(effect.applyOperation())));
            previewOperation = null;
            statusText = statusForOperation(effect.applyOperation());
        }
    }

    private static String normalizeViewMode(String nextViewModeKey) {
        return "GRAPH".equalsIgnoreCase(nextViewModeKey) ? "GRAPH" : "GRID";
    }

    private static String normalizeTool(String nextSelectedTool) {
        return nextSelectedTool == null || nextSelectedTool.isBlank() ? DEFAULT_TOOL : nextSelectedTool;
    }

    private static DungeonMapId requireMapId(@Nullable DungeonMapId mapId) {
        if (mapId == null) {
            throw new IllegalArgumentException("Dungeon-Map-ID fehlt.");
        }
        return mapId;
    }

    private static String statusForOperation(DungeonEditorOperation operation) {
        if (operation instanceof DungeonEditorOperation.SaveRoomNarration) {
            return "Raumbeschreibung gespeichert.";
        }
        if (operation instanceof DungeonEditorOperation.MoveEditorHandle moveHandle) {
            return "Topologieelement verschoben: dq=" + moveHandle.deltaQ()
                    + ", dr=" + moveHandle.deltaR()
                    + ", dz=" + moveHandle.deltaLevel();
        }
        if (operation instanceof DungeonEditorOperation.MoveBoundaryStretch stretch) {
            return "Wandstrecke verschoben: dq=" + stretch.deltaQ()
                    + ", dr=" + stretch.deltaR()
                    + ", dz=" + stretch.deltaLevel();
        }
        if (operation instanceof DungeonEditorOperation.PaintRoomRectangle) {
            return "Raum hinzugefuegt.";
        }
        if (operation instanceof DungeonEditorOperation.DeleteRoomRectangle) {
            return "Raum entfernt.";
        }
        if (operation instanceof DungeonEditorOperation.EditClusterBoundaries boundaries) {
            return boundaries.deleteBoundary() ? "Kanten geloescht." : "Kanten gesetzt.";
        }
        if (operation instanceof DungeonEditorOperation.CreateCorridor) {
            return "Korridor erstellt.";
        }
        if (operation instanceof DungeonEditorOperation.ExtendCorridor) {
            return "Korridor erweitert.";
        }
        if (operation instanceof DungeonEditorOperation.MergeCorridors) {
            return "Korridore zusammengefuehrt.";
        }
        if (operation instanceof DungeonEditorOperation.DeleteCorridor) {
            return "Korridor geloescht.";
        }
        return "";
    }
}


final class InterpretDungeonEditorMainViewInputUseCase {

    private @Nullable PaintSession paintSession;
    private @Nullable BoundaryDraft boundaryDraft;
    private @Nullable CorridorDraft corridorDraft;
    private @Nullable DragSession dragSession;
    private @Nullable BoundaryStretchSession boundaryStretchSession;

    public Effect consume(
            ApplyDungeonEditorSessionCommand.MainViewInput input,
            @Nullable DungeonSnapshot snapshot,
            DungeonEditorSnapshot.Selection selection,
            String selectedTool,
            String viewModeKey,
            int projectionLevel
    ) {
        ApplyDungeonEditorSessionCommand.MainViewInput safeInput = input == null
                ? ApplyDungeonEditorSessionCommand.MainViewInput.empty()
                : input;
        if (safeInput.source() == ApplyDungeonEditorSessionCommand.MainViewInput.Source.LEVEL_SCROLLED) {
            return levelScrolled(safeInput.levelDelta(), selectedTool, projectionLevel, snapshot);
        }
        if (!"GRID".equalsIgnoreCase(viewModeKey) || snapshot == null) {
            return Effect.none();
        }
        PointerState pointer = resolvePointerState(
                safeInput.canvasX(),
                safeInput.canvasY(),
                projectionLevel,
                safeInput.primaryButtonDown(),
                safeInput.secondaryButtonDown(),
                safeInput.hitRef());
        return switch (safeInput.source()) {
            case POINTER_PRESSED -> primaryPressed(pointer, snapshot, selection, selectedTool);
            case POINTER_DRAGGED -> primaryDragged(pointer, snapshot, selectedTool);
            case POINTER_RELEASED -> primaryReleased(pointer, selectedTool);
            case POINTER_MOVED -> pointerMoved(pointer, snapshot, selectedTool);
            case LEVEL_SCROLLED -> Effect.none();
        };
    }

    public void clear() {
        paintSession = null;
        boundaryDraft = null;
        corridorDraft = null;
        dragSession = null;
        boundaryStretchSession = null;
    }

    private Effect primaryPressed(
            PointerState input,
            DungeonSnapshot snapshot,
            DungeonEditorSnapshot.Selection currentSelection,
            String selectedTool
    ) {
        if (input == null) {
            return Effect.none();
        }
        if (boundaryToolSelected(selectedTool)) {
            Effect boundaryEffect = boundaryPressed(input, snapshot, currentSelection, selectedTool);
            if (!boundaryEffect.isNoop()) {
                dragSession = null;
                paintSession = null;
                return boundaryEffect;
            }
        }
        if (corridorToolSelected(selectedTool)) {
            dragSession = null;
            paintSession = null;
            boundaryStretchSession = null;
            return corridorPressed(input, snapshot, selectedTool);
        }
        if (roomPaintToolSelected(selectedTool)) {
            paintSession = new PaintSession(
                    input.q(),
                    input.r(),
                    input.q(),
                    input.r(),
                    input.level(),
                    "Raum loeschen".equals(selectedTool));
            dragSession = null;
            boundaryStretchSession = null;
            return previewFromPaintSession();
        }
        if (!selectionToolSelected(selectedTool)) {
            clear();
            return Effect.none();
        }
        BoundaryStretchSession nextStretchSession = boundaryStretchSession(input, snapshot, currentSelection);
        if (nextStretchSession != null) {
            dragSession = null;
            boundaryStretchSession = nextStretchSession;
            return Effect.select(nextStretchSession.selection());
        }
        HitTarget hit = input.hitTarget();
        if (selectableHit(hit)) {
            DungeonEditorHandleRef handleRef = dragHandleRef(hit);
            DungeonEditorSnapshot.Selection nextSelection = new DungeonEditorSnapshot.Selection(
                    new DungeonTopologyElementRef(
                            toPublishedTopologyKind(hit.topologyRefKind()),
                            hit.topologyRefId()),
                    hit.clusterId(),
                    clusterSelection(hit),
                    handleRef);
            dragSession = draggableHit(hit)
                    ? DragSession.start(nextSelection, input.q(), input.r(), input.level())
                    : null;
            boundaryStretchSession = null;
            return Effect.select(nextSelection);
        }
        clear();
        return Effect.clearedSelection();
    }

    private Effect primaryDragged(
            PointerState input,
            DungeonSnapshot snapshot,
            String selectedTool
    ) {
        if (input == null || !input.primaryButtonDown()) {
            return Effect.none();
        }
        if (boundaryStretchSession != null) {
            boundaryStretchSession = boundaryStretchSession.withCurrentPointer(input.q(), input.r());
            return previewFromStretch(boundaryStretchSession);
        }
        if (boundaryToolSelected(selectedTool)) {
            return previewFromBoundary(input, snapshot, selectedTool);
        }
        if (paintSession != null && roomPaintToolSelected(selectedTool)) {
            paintSession = paintSession.withEnd(input.q(), input.r());
            return previewFromPaintSession();
        }
        if (!selectionToolSelected(selectedTool) || dragSession == null) {
            return Effect.clearPreviewIfNeeded(false);
        }
        dragSession = dragSession.withCurrentPointer(input.q(), input.r());
        return dragSession.moved()
                ? Effect.preview(moveHandleOperation(dragSession))
                : Effect.clearPreviewIfNeeded(true);
    }

    private Effect primaryReleased(PointerState input, String selectedTool) {
        PaintSession currentPaint = paintSession;
        if (currentPaint != null && roomPaintToolSelected(selectedTool)) {
            paintSession = null;
            PaintSession released = input == null ? currentPaint : currentPaint.withEnd(input.q(), input.r());
            return Effect.apply(released.deleteMode()
                    ? new DungeonEditorOperation.DeleteRoomRectangle(
                    new DungeonCellRef(released.startQ(), released.startR(), released.level()),
                    new DungeonCellRef(released.endQ(), released.endR(), released.level()))
                    : new DungeonEditorOperation.PaintRoomRectangle(
                    new DungeonCellRef(released.startQ(), released.startR(), released.level()),
                    new DungeonCellRef(released.endQ(), released.endR(), released.level())));
        }
        if (boundaryStretchSession != null) {
            BoundaryStretchSession releasedSession = input == null
                    ? boundaryStretchSession
                    : boundaryStretchSession.withCurrentPointer(input.q(), input.r());
            boundaryStretchSession = null;
            if (!selectionToolSelected(selectedTool)) {
                return Effect.none();
            }
            if (!releasedSession.moved()) {
                return Effect.select(releasedSession.selection());
            }
            return Effect.apply(new DungeonEditorOperation.MoveBoundaryStretch(
                    releasedSession.clusterId(),
                    releasedSession.sourceEdges(),
                    releasedSession.deltaQ(),
                    releasedSession.deltaR(),
                    releasedSession.deltaLevel()));
        }
        if (dragSession == null || input == null) {
            return Effect.clearPreviewIfNeeded(false);
        }
        DragSession releasedSession = dragSession;
        dragSession = null;
        if (!selectionToolSelected(selectedTool) || !releasedSession.moved()) {
            return Effect.clearPreviewIfNeeded(true);
        }
        return Effect.apply(moveHandleOperation(releasedSession));
    }

    private Effect pointerMoved(
            PointerState input,
            DungeonSnapshot snapshot,
            String selectedTool
    ) {
        if (input == null || !boundaryToolSelected(selectedTool)) {
            return Effect.clearPreviewIfNeeded(boundaryDraft != null);
        }
        return previewFromBoundary(input, snapshot, selectedTool);
    }

    private Effect levelScrolled(
            int delta,
            String selectedTool,
            int projectionLevel,
            @Nullable DungeonSnapshot snapshot
    ) {
        if (delta == 0) {
            return Effect.none();
        }
        if (boundaryStretchSession != null) {
            return Effect.none();
        }
        if (dragSession == null || !selectionToolSelected(selectedTool) || snapshot == null) {
            return Effect.projectionLevel(delta < 0 ? -1 : 1);
        }
        dragSession = dragSession.withCurrentLevel(projectionLevel + delta);
        return dragSession.moved()
                ? Effect.preview(moveHandleOperation(dragSession))
                : Effect.clearPreviewIfNeeded(true);
    }

    private Effect previewFromPaintSession() {
        if (paintSession == null) {
            return Effect.clearPreviewIfNeeded(true);
        }
        return Effect.preview(paintSession.deleteMode()
                ? new DungeonEditorOperation.DeleteRoomRectangle(
                new DungeonCellRef(paintSession.startQ(), paintSession.startR(), paintSession.level()),
                new DungeonCellRef(paintSession.endQ(), paintSession.endR(), paintSession.level()))
                : new DungeonEditorOperation.PaintRoomRectangle(
                new DungeonCellRef(paintSession.startQ(), paintSession.startR(), paintSession.level()),
                new DungeonCellRef(paintSession.endQ(), paintSession.endR(), paintSession.level())));
    }

    private Effect previewFromStretch(@Nullable BoundaryStretchSession stretchSession) {
        if (stretchSession == null || !stretchSession.moved()) {
            return Effect.clearPreviewIfNeeded(true);
        }
        return Effect.preview(new DungeonEditorOperation.MoveBoundaryStretch(
                stretchSession.clusterId(),
                stretchSession.sourceEdges(),
                stretchSession.deltaQ(),
                stretchSession.deltaR(),
                stretchSession.deltaLevel()));
    }

    private Effect previewFromBoundary(
            PointerState input,
            DungeonSnapshot snapshot,
            String selectedTool
    ) {
        if ("Tuer setzen".equals(selectedTool) || "Tuer loeschen".equals(selectedTool)) {
            BoundaryTarget boundary = input.boundaryTarget();
            boolean deleteMode = "Tuer loeschen".equals(selectedTool);
            if (!editableDoorBoundary(snapshot, boundary, deleteMode)) {
                return Effect.clearPreviewIfNeeded(true);
            }
            return Effect.preview(new DungeonEditorOperation.EditClusterBoundaries(
                    resolveBoundaryClusterId(snapshot, boundary),
                    List.of(new DungeonEdgeRef(boundary.start().toDungeonCellRef(), boundary.end().toDungeonCellRef())),
                    DungeonBoundaryKind.DOOR,
                    deleteMode));
        }
        if (boundaryDraft == null) {
            return Effect.clearPreviewIfNeeded(false);
        }
        Set<EdgeKey> previewEdges = new java.util.LinkedHashSet<>(boundaryDraft.previewEdges());
        PathResult candidate = previewCandidate(input, snapshot, boundaryDraft, "Wand loeschen".equals(selectedTool));
        previewEdges.addAll(candidate.committedEdges());
        if (previewEdges.isEmpty()) {
            return Effect.clearPreviewIfNeeded(true);
        }
        return Effect.preview(new DungeonEditorOperation.EditClusterBoundaries(
                boundaryDraft.clusterId(),
                previewEdges.stream().map(EdgeKey::toEdgeRef).toList(),
                DungeonBoundaryKind.WALL,
                boundaryDraft.deleteMode()));
    }

    private Effect boundaryPressed(
            PointerState input,
            DungeonSnapshot snapshot,
            DungeonEditorSnapshot.Selection currentSelection,
            String selectedTool
    ) {
        if (doorBoundaryToolSelected(selectedTool)) {
            return pressedDoorBoundary(input, snapshot, selectedTool);
        }
        VertexTarget vertex = input.vertexTarget();
        if (vertex == null || !vertex.present()) {
            return clearOnMissingBoundaryDraft();
        }
        boolean deleteMode = "Wand loeschen".equals(selectedTool);
        long clusterId = resolveClusterId(input, vertex, deleteMode, snapshot, currentSelection);
        if (clusterId <= 0L) {
            return clearOnMissingBoundaryDraft();
        }
        VertexKey nextVertex = vertexKey(vertex);
        if (!matchesBoundaryDraft(clusterId)) {
            return startBoundaryDraft(snapshot, clusterId, vertex, deleteMode, nextVertex);
        }
        return advanceBoundaryDraft(input, snapshot, selectedTool, clusterId, deleteMode, nextVertex);
    }

    private static boolean doorBoundaryToolSelected(String selectedTool) {
        return "Tuer setzen".equals(selectedTool) || "Tuer loeschen".equals(selectedTool);
    }

    private Effect pressedDoorBoundary(
            PointerState input,
            DungeonSnapshot snapshot,
            String selectedTool
    ) {
        if (!input.primaryButtonDown()) {
            return Effect.none();
        }
        BoundaryTarget boundary = input.boundaryTarget();
        boolean deleteMode = "Tuer loeschen".equals(selectedTool);
        if (!editableDoorBoundary(snapshot, boundary, deleteMode)) {
            return Effect.none();
        }
        return Effect.apply(new DungeonEditorOperation.EditClusterBoundaries(
                resolveBoundaryClusterId(snapshot, boundary),
                List.of(new DungeonEdgeRef(boundary.start().toDungeonCellRef(), boundary.end().toDungeonCellRef())),
                DungeonBoundaryKind.DOOR,
                deleteMode));
    }

    private Effect clearOnMissingBoundaryDraft() {
        if (boundaryDraft == null) {
            clear();
        }
        return Effect.none();
    }

    private boolean matchesBoundaryDraft(long clusterId) {
        return boundaryDraft != null && boundaryDraft.clusterId() == clusterId;
    }

    private Effect startBoundaryDraft(
            DungeonSnapshot snapshot,
            long clusterId,
            VertexTarget vertex,
            boolean deleteMode,
            VertexKey nextVertex
    ) {
        if (!isEditableVertex(snapshot, clusterId, vertex, deleteMode)) {
            return Effect.none();
        }
        boundaryDraft = new BoundaryDraft(clusterId, deleteMode, nextVertex, nextVertex, Set.of());
        return Effect.clearPreviewIfNeeded(true);
    }

    private Effect advanceBoundaryDraft(
            PointerState input,
            DungeonSnapshot snapshot,
            String selectedTool,
            long clusterId,
            boolean deleteMode,
            VertexKey nextVertex
    ) {
        BoundaryDraft currentDraft = java.util.Objects.requireNonNull(boundaryDraft, "boundaryDraft");
        if (currentDraft.currentVertex().equals(nextVertex)) {
            return previewFromBoundary(input, snapshot, selectedTool);
        }
        PathResult path = deleteMode
                ? findDeletePath(snapshot, clusterId, currentDraft.currentVertex(), nextVertex)
                : findCreatePath(snapshot, clusterId, currentDraft.currentVertex(), nextVertex);
        if (!path.hasRoute()) {
            return Effect.clearPreviewIfNeeded(true);
        }
        Set<EdgeKey> previewEdges = new java.util.LinkedHashSet<>(currentDraft.previewEdges());
        previewEdges.addAll(path.committedEdges());
        boundaryDraft = new BoundaryDraft(clusterId, deleteMode, currentDraft.startVertex(), nextVertex, previewEdges);
        if (!deleteMode && touchesExistingWall(snapshot, clusterId, nextVertex)) {
            return commitBoundaryDraft();
        }
        return previewFromBoundary(input, snapshot, selectedTool);
    }

    private Effect commitBoundaryDraft() {
        BoundaryDraft current = boundaryDraft;
        boundaryDraft = null;
        if (current == null || current.previewEdges().isEmpty()) {
            return Effect.clearPreviewIfNeeded(true);
        }
        return Effect.apply(new DungeonEditorOperation.EditClusterBoundaries(
                current.clusterId(),
                current.previewEdges().stream().map(EdgeKey::toEdgeRef).toList(),
                DungeonBoundaryKind.WALL,
                current.deleteMode()));
    }

    private Effect corridorPressed(
            PointerState input,
            DungeonSnapshot snapshot,
            String selectedTool
    ) {
        if (input == null || !input.primaryButtonDown()) {
            return Effect.none();
        }
        PendingCorridorTarget target = resolveCorridorTarget(input, snapshot);
        if ("Korridor loeschen".equals(selectedTool)) {
            corridorDraft = null;
            long corridorId = target == null ? 0L : target.deleteCorridorId();
            if (corridorId > 0L) {
                return Effect.applyWithStatus(
                        new DungeonEditorOperation.DeleteCorridor(corridorId),
                        "");
            }
            return Effect.clearedSelection();
        }
        if (target == null) {
            corridorDraft = null;
            return Effect.clearedSelection();
        }
        if (corridorDraft == null) {
            corridorDraft = new CorridorDraft(target);
            return Effect.select(target.selection(), "Start: " + target.displayLabel() + ". Zieltuer oder Korridoranker anklicken.");
        }
        PendingCorridorTarget start = corridorDraft.start();
        corridorDraft = null;
        if (start.targetKey().equals(target.targetKey())) {
            return Effect.select(target.selection(), "");
        }
        return applyCorridorDraft(start, target);
    }

    private static Effect applyCorridorDraft(PendingCorridorTarget start, PendingCorridorTarget target) {
        if (start.endpoint() != null && target.endpoint() != null) {
            return Effect.apply(new DungeonEditorOperation.CreateCorridor(start.endpoint(), target.endpoint()));
        }
        return Effect.none();
    }

    private static @Nullable PendingCorridorTarget resolveCorridorTarget(
            PointerState input,
            DungeonSnapshot snapshot
    ) {
        PendingCorridorTarget fixedDoorTarget = fixedDoorTarget(input, snapshot);
        if (fixedDoorTarget != null) {
            return fixedDoorTarget;
        }
        PendingCorridorTarget explicitAnchorTarget = explicitAnchorTarget(input.hitTarget());
        if (explicitAnchorTarget != null) {
            return explicitAnchorTarget;
        }
        PendingCorridorTarget roomTarget = roomTarget(input, snapshot, input.hitTarget());
        if (roomTarget != null) {
            return roomTarget;
        }
        PendingCorridorTarget corridorTarget = corridorTarget(input);
        if (corridorTarget != null) {
            return corridorTarget;
        }
        return null;
    }

    private static @Nullable PendingCorridorTarget fixedDoorTarget(
            PointerState input,
            DungeonSnapshot snapshot
    ) {
        BoundaryTarget boundary = input == null ? null : input.boundaryTarget();
        BoundaryRoomTouch roomTouch = perimeterDoorRoomTouch(snapshot, boundary);
        if (roomTouch == null || boundary == null) {
            return null;
        }
        String direction = boundaryDirectionForRoomCell(boundary, roomTouch.roomCell());
        if (direction.isBlank()) {
            return null;
        }
        return new PendingCorridorTarget.EndpointTarget(
                "room:" + roomTouch.room().id() + ":door:" + boundary.topologyRefId(),
                "Tuer " + boundary.topologyRefId(),
                selectionForBoundary(boundary, roomTouch.room().clusterId()),
                roomTouch.room().clusterId(),
                new DungeonEditorOperation.CorridorDoorEndpoint(
                        roomTouch.room().id(),
                        roomTouch.room().clusterId(),
                        roomTouch.roomCell(),
                        direction,
                        new DungeonTopologyElementRef(
                                toPublishedTopologyKind(boundary.topologyRefKind()),
                                boundary.topologyRefId())));
    }

    private static @Nullable PendingCorridorTarget explicitAnchorTarget(HitTarget hit) {
        if (hit == null || hit.handleRef() == null || !"CORRIDOR_ANCHOR".equals(hit.handleRef().kind())) {
            return null;
        }
        long hostCorridorId = hit.handleRef().corridorId();
        if (hostCorridorId <= 0L) {
            return null;
        }
        return new PendingCorridorTarget.EndpointTarget(
                "anchor:" + hit.topologyRefId(),
                "Anker " + hit.topologyRefId(),
                new DungeonEditorSnapshot.Selection(
                        new DungeonTopologyElementRef(
                                src.domain.dungeon.published.DungeonTopologyElementKind.CORRIDOR,
                                hostCorridorId),
                        0L,
                        false,
                        null),
                hostCorridorId,
                new DungeonEditorOperation.CorridorAnchorEndpoint(
                        hostCorridorId,
                        hit.handleRef().anchor().toDungeonCellRef(),
                        new DungeonTopologyElementRef(
                                src.domain.dungeon.published.DungeonTopologyElementKind.CORRIDOR_ANCHOR,
                                hit.topologyRefId())));
    }

    private static @Nullable PendingCorridorTarget corridorTarget(PointerState input) {
        HitTarget hit = input == null ? null : input.hitTarget();
        if (hit == null) {
            return null;
        }
        long corridorId = hit.topologyRefId() > 0L && "CORRIDOR".equals(hit.topologyRefKind())
                ? hit.topologyRefId()
                : (hit.kind() == HitKind.CORRIDOR ? hit.ownerId() : 0L);
        if (corridorId <= 0L) {
            return null;
        }
        return new PendingCorridorTarget.EndpointTarget(
                "corridor:" + corridorId + ":" + input.q() + ":" + input.r() + ":" + input.level(),
                "Korridor " + corridorId,
                new DungeonEditorSnapshot.Selection(
                        new DungeonTopologyElementRef(
                                src.domain.dungeon.published.DungeonTopologyElementKind.CORRIDOR,
                                corridorId),
                        0L,
                        false,
                        null),
                corridorId,
                new DungeonEditorOperation.CorridorAnchorEndpoint(
                        corridorId,
                        new DungeonCellRef(input.q(), input.r(), input.level()),
                        DungeonTopologyElementRef.empty()));
    }

    private static @Nullable PendingCorridorTarget roomTarget(
            PointerState input,
            DungeonSnapshot snapshot,
            HitTarget hit
    ) {
        DungeonAreaSnapshot room = roomArea(snapshot, hit);
        if (room == null) {
            return null;
        }
        DungeonCellRef roomCell = corridorRoomCell(room, input.q(), input.r());
        String direction = corridorDirection(room, roomCell);
        if (direction.isBlank()) {
            return null;
        }
        return new PendingCorridorTarget.EndpointTarget(
                "room:" + room.id(),
                room.label().isBlank() ? "Raum " + room.id() : room.label(),
                new DungeonEditorSnapshot.Selection(room.topologyRef(), room.clusterId(), false, null),
                room.clusterId(),
                new DungeonEditorOperation.CorridorDoorEndpoint(
                        room.id(),
                        room.clusterId(),
                        roomCell,
                        direction,
                        DungeonTopologyElementRef.empty()));
    }

    private @Nullable BoundaryStretchSession boundaryStretchSession(
            PointerState input,
            DungeonSnapshot snapshot,
            DungeonEditorSnapshot.Selection currentSelection
    ) {
        BoundaryTarget boundaryTarget = input == null ? null : input.boundaryTarget();
        if (input == null
                || !input.primaryButtonDown()
                || boundaryTarget == null
                || !boundaryTarget.present()) {
            return null;
        }
        BoundaryStretchOrientation orientation = BoundaryStretchOrientation.from(boundaryTarget);
        if (orientation == null) {
            return null;
        }
        long clusterId = resolveBoundaryClusterId(snapshot, boundaryTarget);
        if (clusterId <= 0L) {
            return null;
        }
        List<DungeonEdgeRef> sourceEdges = resolveBoundaryStretchEdges(snapshot, clusterId, boundaryTarget, orientation);
        if (sourceEdges.isEmpty()) {
            return null;
        }
        DungeonEditorSnapshot.Selection nextSelection = selectionForBoundaryStretch(snapshot, currentSelection, clusterId, boundaryTarget);
        return new BoundaryStretchSession(
                nextSelection,
                clusterId,
                sourceEdges,
                orientation,
                input.q(),
                input.r(),
                input.level(),
                input.q(),
                input.r());
    }

    private static DungeonEditorSnapshot.Selection selectionForBoundaryStretch(
            DungeonSnapshot snapshot,
            DungeonEditorSnapshot.Selection currentSelection,
            long clusterId,
            BoundaryTarget boundaryTarget
    ) {
        if (currentSelection != null
                && currentSelection.clusterSelection()
                && currentSelection.clusterId() == clusterId) {
            return currentSelection;
        }
        DungeonAreaSnapshot clusterArea = firstClusterArea(snapshot, clusterId);
        if (clusterArea != null) {
            return new DungeonEditorSnapshot.Selection(
                    clusterArea.topologyRef(),
                    clusterArea.clusterId(),
                    true,
                    null);
        }
        return new DungeonEditorSnapshot.Selection(
                new DungeonTopologyElementRef(
                        toPublishedTopologyKind(boundaryTarget.topologyRefKind()),
                        boundaryTarget.topologyRefId()),
                clusterId,
                true,
                null);
    }

    private static @Nullable DungeonAreaSnapshot firstClusterArea(DungeonSnapshot snapshot, long clusterId) {
        if (snapshot == null || snapshot.map() == null || clusterId <= 0L) {
            return null;
        }
        return snapshot.map().areas().stream()
                .filter(area -> area.kind() == DungeonAreaKind.ROOM && area.clusterId() == clusterId)
                .findFirst()
                .orElse(null);
    }

    private static List<DungeonEdgeRef> resolveBoundaryStretchEdges(
            DungeonSnapshot snapshot,
            long clusterId,
            BoundaryTarget boundaryTarget,
            BoundaryStretchOrientation orientation
    ) {
        if (snapshot == null || snapshot.map() == null || !boundaryTarget.present()) {
            return List.of();
        }
        int level = boundaryTarget.start().level();
        Set<DungeonCellRef> clusterCells = clusterCells(snapshot, clusterId, level);
        if (clusterCells.isEmpty()) {
            return List.of();
        }
        DungeonEdgeRef clickedEdge = new DungeonEdgeRef(
                boundaryTarget.start().toDungeonCellRef(),
                boundaryTarget.end().toDungeonCellRef());
        Boolean outer = outerStretch(clickedEdge, clusterCells);
        if (outer == null) {
            return List.of();
        }
        java.util.Map<Integer, DungeonEdgeRef> edgesByVariable =
                boundaryStretchEdgesOnLine(snapshot, clusterCells, clickedEdge, orientation, outer);
        List<DungeonEdgeRef> contiguousEdges = contiguousStretchEdges(edgesByVariable, clickedEdge, orientation);
        return contiguousEdges.isEmpty() ? List.of(clickedEdge) : contiguousEdges;
    }

    private static @Nullable Boolean outerStretch(DungeonEdgeRef clickedEdge, Set<DungeonCellRef> clusterCells) {
        int clickedTouchCount = touchingClusterCount(clickedEdge, clusterCells);
        if (clickedTouchCount < 1) {
            return null;
        }
        return clickedTouchCount == 1;
    }

    private static java.util.Map<Integer, DungeonEdgeRef> boundaryStretchEdgesOnLine(
            DungeonSnapshot snapshot,
            Set<DungeonCellRef> clusterCells,
            DungeonEdgeRef clickedEdge,
            BoundaryStretchOrientation orientation,
            boolean outer
    ) {
        java.util.Map<Integer, DungeonEdgeRef> edgesByVariable = new java.util.LinkedHashMap<>();
        int level = clickedEdge.from().level();
        int fixedCoordinate = fixedCoordinate(orientation, clickedEdge);
        for (DungeonBoundarySnapshot boundary : snapshot.map().boundaries()) {
            DungeonEdgeRef edge = boundary.edge();
            if (!matchesStretchLine(edge, clusterCells, level, orientation, fixedCoordinate, outer)) {
                continue;
            }
            edgesByVariable.put(variableCoordinate(orientation, edge), edge);
        }
        return edgesByVariable;
    }

    private static boolean matchesStretchLine(
            @Nullable DungeonEdgeRef edge,
            Set<DungeonCellRef> clusterCells,
            int level,
            BoundaryStretchOrientation orientation,
            int fixedCoordinate,
            boolean outer
    ) {
        if (edge == null
                || edge.from() == null
                || edge.to() == null
                || edge.from().level() != level
                || edge.to().level() != level
                || !sameOrientation(orientation, edge)
                || fixedCoordinate(orientation, edge) != fixedCoordinate) {
            return false;
        }
        int touchCount = touchingClusterCount(edge, clusterCells);
        return touchCount >= 1 && (touchCount == 1) == outer;
    }

    private static List<DungeonEdgeRef> contiguousStretchEdges(
            java.util.Map<Integer, DungeonEdgeRef> edgesByVariable,
            DungeonEdgeRef clickedEdge,
            BoundaryStretchOrientation orientation
    ) {
        int min = variableCoordinate(orientation, clickedEdge);
        int max = min;
        while (edgesByVariable.containsKey(min - 1)) {
            min--;
        }
        while (edgesByVariable.containsKey(max + 1)) {
            max++;
        }
        List<DungeonEdgeRef> result = new ArrayList<>();
        for (int variable = min; variable <= max; variable++) {
            DungeonEdgeRef edge = edgesByVariable.get(variable);
            if (edge != null) {
                result.add(edge);
            }
        }
        return List.copyOf(result);
    }

    private static Set<DungeonCellRef> clusterCells(DungeonSnapshot snapshot, long clusterId, int level) {
        if (snapshot == null || snapshot.map() == null || clusterId <= 0L) {
            return Set.of();
        }
        Set<DungeonCellRef> result = new java.util.LinkedHashSet<>();
        for (DungeonAreaSnapshot area : snapshot.map().areas()) {
            if (area.kind() != DungeonAreaKind.ROOM || area.clusterId() != clusterId) {
                continue;
            }
            for (DungeonCellRef cell : area.cells()) {
                if (cell.level() == level) {
                    result.add(cell);
                }
            }
        }
        return Set.copyOf(result);
    }

    private static int touchingClusterCount(DungeonEdgeRef edge, Set<DungeonCellRef> clusterCells) {
        if (edge == null || edge.from() == null || edge.to() == null || edge.from().level() != edge.to().level()) {
            return 0;
        }
        if (edge.from().r() == edge.to().r()) {
            return horizontalTouchingClusterCount(edge.from(), edge.to(), clusterCells);
        }
        if (edge.from().q() == edge.to().q()) {
            return verticalTouchingClusterCount(edge.from(), edge.to(), clusterCells);
        }
        return 0;
    }

    private static int horizontalTouchingClusterCount(
            DungeonCellRef from,
            DungeonCellRef to,
            Set<DungeonCellRef> clusterCells
    ) {
        int count = 0;
        for (int q = Math.min(from.q(), to.q()); q < Math.max(from.q(), to.q()); q++) {
            if (clusterCells.contains(new DungeonCellRef(q, from.r() - 1, from.level()))) {
                count++;
            }
            if (clusterCells.contains(new DungeonCellRef(q, from.r(), from.level()))) {
                count++;
            }
        }
        return count;
    }

    private static int verticalTouchingClusterCount(
            DungeonCellRef from,
            DungeonCellRef to,
            Set<DungeonCellRef> clusterCells
    ) {
        int count = 0;
        for (int r = Math.min(from.r(), to.r()); r < Math.max(from.r(), to.r()); r++) {
            if (clusterCells.contains(new DungeonCellRef(from.q() - 1, r, from.level()))) {
                count++;
            }
            if (clusterCells.contains(new DungeonCellRef(from.q(), r, from.level()))) {
                count++;
            }
        }
        return count;
    }

    private static boolean sameOrientation(BoundaryStretchOrientation orientation, DungeonEdgeRef edge) {
        return switch (orientation) {
            case HORIZONTAL -> edge.from().r() == edge.to().r();
            case VERTICAL -> edge.from().q() == edge.to().q();
        };
    }

    private static int fixedCoordinate(BoundaryStretchOrientation orientation, DungeonEdgeRef edge) {
        return orientation == BoundaryStretchOrientation.VERTICAL ? edge.from().q() : edge.from().r();
    }

    private static int variableCoordinate(BoundaryStretchOrientation orientation, DungeonEdgeRef edge) {
        return orientation == BoundaryStretchOrientation.VERTICAL
                ? Math.min(edge.from().r(), edge.to().r())
                : Math.min(edge.from().q(), edge.to().q());
    }

    private static boolean editableDoorBoundary(
            @Nullable DungeonSnapshot snapshot,
            @Nullable BoundaryTarget boundary,
            boolean deleteMode
    ) {
        if (boundary == null || !boundary.present()) {
            return false;
        }
        if (deleteMode) {
            return "DOOR".equals(boundary.kind());
        }
        return !"DOOR".equals(boundary.kind()) && touchingRoomCount(snapshot, boundary) >= 1;
    }

    private static int touchingRoomCount(@Nullable DungeonSnapshot snapshot, BoundaryTarget boundary) {
        if (snapshot == null || snapshot.map() == null || boundary == null) {
            return 0;
        }
        Set<Long> roomIds = new java.util.LinkedHashSet<>();
        List<CellKey> touchingCells = touchingCells(
                boundary.start().toDungeonCellRef(),
                boundary.end().toDungeonCellRef()).stream()
                .map(cell -> new CellKey(cell.q(), cell.r(), cell.level()))
                .toList();
        for (DungeonAreaSnapshot area : snapshot.map().areas()) {
            if (area.kind() != DungeonAreaKind.ROOM) {
                continue;
            }
            for (DungeonCellRef cell : area.cells()) {
                if (touchingCells.contains(new CellKey(cell.q(), cell.r(), cell.level()))) {
                    roomIds.add(area.id());
                }
            }
        }
        return roomIds.size();
    }

    private static long resolveBoundaryClusterId(@Nullable DungeonSnapshot snapshot, @Nullable BoundaryTarget boundaryTarget) {
        if (snapshot == null || snapshot.map() == null || boundaryTarget == null || !boundaryTarget.present()) {
            return 0L;
        }
        List<CellKey> touchingCells = touchingCells(
                boundaryTarget.start().toDungeonCellRef(),
                boundaryTarget.end().toDungeonCellRef()).stream()
                .map(cell -> new CellKey(cell.q(), cell.r(), cell.level()))
                .toList();
        return snapshot.map().areas().stream()
                .filter(area -> area.kind() == DungeonAreaKind.ROOM && area.clusterId() > 0L)
                .filter(area -> area.cells().stream()
                        .map(cell -> new CellKey(cell.q(), cell.r(), cell.level()))
                        .anyMatch(touchingCells::contains))
                .map(DungeonAreaSnapshot::clusterId)
                .findFirst()
                .orElse(0L);
    }

    private static long resolveClusterId(
            PointerState input,
            VertexTarget vertex,
            boolean deleteMode,
            DungeonSnapshot snapshot,
            DungeonEditorSnapshot.Selection selection
    ) {
        if (selection != null
                && selection.clusterId() > 0L
                && isEditableVertex(snapshot, selection.clusterId(), vertex, deleteMode)) {
            return selection.clusterId();
        }
        BoundaryTarget boundary = input.boundaryTarget();
        long boundaryClusterId = resolveBoundaryClusterId(snapshot, boundary);
        if (boundaryClusterId > 0L && isEditableVertex(snapshot, boundaryClusterId, vertex, deleteMode)) {
            return boundaryClusterId;
        }
        return nearestEditableCluster(snapshot, vertex, deleteMode);
    }

    private static long nearestEditableCluster(DungeonSnapshot snapshot, VertexTarget vertex, boolean deleteMode) {
        return clusterCellsByCluster(snapshot, vertex.level()).entrySet().stream()
                .filter(entry -> isEditableVertex(snapshot, entry.getKey(), vertex, deleteMode))
                .min(java.util.Comparator
                        .comparingDouble((java.util.Map.Entry<Long, Set<CellKey>> entry) -> centerDistance(entry.getValue(), vertex))
                        .thenComparingLong(java.util.Map.Entry::getKey))
                .map(java.util.Map.Entry::getKey)
                .orElse(0L);
    }

    private static double centerDistance(Set<CellKey> cells, VertexTarget vertex) {
        double q = 0.0;
        double r = 0.0;
        for (CellKey cell : cells) {
            q += cell.q() + 0.5;
            r += cell.r() + 0.5;
        }
        int count = Math.max(1, cells.size());
        return Math.hypot(q / count - vertex.q(), r / count - vertex.r());
    }

    private static boolean isEditableVertex(DungeonSnapshot snapshot, long clusterId, VertexTarget vertex, boolean deleteMode) {
        Set<EdgeKey> edges = deleteMode
                ? existingInternalBoundaryEdges(snapshot, clusterId, vertex.level(), DungeonBoundaryKind.WALL)
                : internalClusterEdges(snapshot, clusterId, vertex.level());
        VertexKey key = new VertexKey(vertex.q(), vertex.r(), vertex.level());
        return edges.stream().anyMatch(edge -> edge.touches(key));
    }

    private static PathResult previewCandidate(
            PointerState input,
            DungeonSnapshot snapshot,
            BoundaryDraft currentDraft,
            boolean deleteMode
    ) {
        VertexTarget vertex = input == null ? null : input.vertexTarget();
        if (snapshot == null || vertex == null || !vertex.present()) {
            return PathResult.empty();
        }
        if (!isEditableVertex(snapshot, currentDraft.clusterId(), vertex, deleteMode)) {
            return PathResult.empty();
        }
        VertexKey nextVertex = vertexKey(vertex);
        if (currentDraft.currentVertex().equals(nextVertex)) {
            return PathResult.empty();
        }
        return deleteMode
                ? findDeletePath(snapshot, currentDraft.clusterId(), currentDraft.currentVertex(), nextVertex)
                : findCreatePath(snapshot, currentDraft.clusterId(), currentDraft.currentVertex(), nextVertex);
    }

    private static PathResult findCreatePath(DungeonSnapshot snapshot, long clusterId, VertexKey start, VertexKey goal) {
        Set<EdgeKey> traversableEdges = internalClusterEdges(snapshot, clusterId, start.level());
        List<EdgeKey> route = shortestPath(start, goal, traversableEdges);
        if (route.isEmpty()) {
            return PathResult.empty();
        }
        Set<EdgeKey> doors = existingInternalBoundaryEdges(snapshot, clusterId, start.level(), DungeonBoundaryKind.DOOR);
        Set<EdgeKey> committed = new java.util.LinkedHashSet<>(route);
        committed.removeAll(doors);
        return new PathResult(route, committed);
    }

    private static PathResult findDeletePath(DungeonSnapshot snapshot, long clusterId, VertexKey start, VertexKey goal) {
        Set<EdgeKey> walls = existingInternalBoundaryEdges(snapshot, clusterId, start.level(), DungeonBoundaryKind.WALL);
        List<EdgeKey> route = shortestPath(start, goal, walls);
        return route.isEmpty() ? PathResult.empty() : new PathResult(route, new java.util.LinkedHashSet<>(route));
    }

    private static List<EdgeKey> shortestPath(VertexKey start, VertexKey goal, Set<EdgeKey> traversableEdges) {
        if (start == null || goal == null || traversableEdges == null || traversableEdges.isEmpty()) {
            return List.of();
        }
        java.util.Map<VertexKey, Set<VertexKey>> adjacency = adjacency(traversableEdges);
        if (!adjacency.containsKey(start) || !adjacency.containsKey(goal)) {
            return List.of();
        }
        java.util.ArrayDeque<VertexKey> queue = new java.util.ArrayDeque<>();
        java.util.Map<VertexKey, VertexKey> previous = new java.util.LinkedHashMap<>();
        queue.add(start);
        previous.put(start, null);
        while (!queue.isEmpty()) {
            VertexKey current = queue.removeFirst();
            if (current.equals(goal)) {
                break;
            }
            for (VertexKey neighbor : adjacency.getOrDefault(current, Set.of()).stream().sorted(VertexKey.ORDER).toList()) {
                if (previous.containsKey(neighbor)) {
                    continue;
                }
                previous.put(neighbor, current);
                queue.addLast(neighbor);
            }
        }
        if (!previous.containsKey(goal)) {
            return List.of();
        }
        List<EdgeKey> path = new ArrayList<>();
        VertexKey current = goal;
        while (!current.equals(start)) {
            VertexKey parent = previous.get(current);
            if (parent == null) {
                return List.of();
            }
            path.add(EdgeKey.between(parent, current));
            current = parent;
        }
        java.util.Collections.reverse(path);
        return List.copyOf(path);
    }

    private static java.util.Map<VertexKey, Set<VertexKey>> adjacency(Set<EdgeKey> edges) {
        java.util.Map<VertexKey, Set<VertexKey>> result = new java.util.LinkedHashMap<>();
        for (EdgeKey edge : edges == null ? Set.<EdgeKey>of() : edges) {
            result.computeIfAbsent(edge.start(), ignored -> new java.util.LinkedHashSet<>()).add(edge.end());
            result.computeIfAbsent(edge.end(), ignored -> new java.util.LinkedHashSet<>()).add(edge.start());
        }
        return java.util.Map.copyOf(result);
    }

    private static Set<EdgeKey> internalClusterEdges(DungeonSnapshot snapshot, long clusterId, int level) {
        Set<CellKey> cells = clusterCellsByCluster(snapshot, level).getOrDefault(clusterId, Set.of());
        Set<EdgeKey> result = new java.util.LinkedHashSet<>();
        for (CellKey cell : cells) {
            for (Direction direction : Direction.values()) {
                CellKey neighbor = cell.neighbor(direction);
                if (cells.contains(neighbor)) {
                    result.add(EdgeKey.sideOf(cell, direction));
                }
            }
        }
        return Set.copyOf(result);
    }

    private static Set<EdgeKey> existingInternalBoundaryEdges(
            DungeonSnapshot snapshot,
            long clusterId,
            int level,
            DungeonBoundaryKind kind
    ) {
        Set<EdgeKey> internalEdges = internalClusterEdges(snapshot, clusterId, level);
        Set<EdgeKey> result = new java.util.LinkedHashSet<>();
        for (DungeonBoundarySnapshot boundary : boundaries(snapshot)) {
            if (boundary.edge() == null
                    || boundary.edge().from() == null
                    || boundary.edge().to() == null
                    || boundary.edge().from().level() != level
                    || !boundaryKindMatches(boundary, kind)) {
                continue;
            }
            EdgeKey edge = EdgeKey.from(boundary.edge());
            if (internalEdges.contains(edge)) {
                result.add(edge);
            }
        }
        return Set.copyOf(result);
    }

    private static boolean touchesExistingWall(DungeonSnapshot snapshot, long clusterId, VertexKey vertex) {
        Set<EdgeKey> edges = new java.util.LinkedHashSet<>(existingInternalBoundaryEdges(
                snapshot,
                clusterId,
                vertex.level(),
                DungeonBoundaryKind.WALL));
        edges.addAll(outerClusterEdges(snapshot, clusterId, vertex.level()));
        return edges.stream().anyMatch(edge -> edge.touches(vertex));
    }

    private static Set<EdgeKey> outerClusterEdges(DungeonSnapshot snapshot, long clusterId, int level) {
        Set<CellKey> cells = clusterCellsByCluster(snapshot, level).getOrDefault(clusterId, Set.of());
        Set<EdgeKey> result = new java.util.LinkedHashSet<>();
        for (CellKey cell : cells) {
            for (Direction direction : Direction.values()) {
                if (!cells.contains(cell.neighbor(direction))) {
                    result.add(EdgeKey.sideOf(cell, direction));
                }
            }
        }
        return Set.copyOf(result);
    }

    private static java.util.Map<Long, Set<CellKey>> clusterCellsByCluster(DungeonSnapshot snapshot, int level) {
        java.util.Map<Long, Set<CellKey>> result = new java.util.LinkedHashMap<>();
        if (snapshot == null || snapshot.map() == null) {
            return java.util.Map.of();
        }
        for (DungeonAreaSnapshot area : snapshot.map().areas()) {
            if (area.kind() != DungeonAreaKind.ROOM || area.clusterId() <= 0L) {
                continue;
            }
            Set<CellKey> cells = result.computeIfAbsent(area.clusterId(), ignored -> new java.util.LinkedHashSet<>());
            for (DungeonCellRef cell : area.cells()) {
                if (cell.level() == level) {
                    cells.add(new CellKey(cell.q(), cell.r(), cell.level()));
                }
            }
        }
        java.util.Map<Long, Set<CellKey>> immutable = new java.util.LinkedHashMap<>();
        for (java.util.Map.Entry<Long, Set<CellKey>> entry : result.entrySet()) {
            immutable.put(entry.getKey(), Set.copyOf(entry.getValue()));
        }
        return java.util.Map.copyOf(immutable);
    }

    private static List<DungeonBoundarySnapshot> boundaries(DungeonSnapshot snapshot) {
        return snapshot == null || snapshot.map() == null ? List.of() : snapshot.map().boundaries();
    }

    private static boolean boundaryKindMatches(DungeonBoundarySnapshot boundary, DungeonBoundaryKind kind) {
        if (kind == DungeonBoundaryKind.DOOR) {
            return "door".equalsIgnoreCase(boundary.kind());
        }
        return !"door".equalsIgnoreCase(boundary.kind());
    }

    private static @Nullable DungeonAreaSnapshot roomArea(DungeonSnapshot snapshot, HitTarget hit) {
        if (snapshot == null || snapshot.map() == null || hit == null) {
            return null;
        }
        if (hit.kind() == HitKind.ROOM && hit.ownerId() > 0L) {
            return roomAreaById(snapshot, hit.ownerId());
        }
        if (hit.kind() == HitKind.LABEL && "ROOM".equals(hit.topologyRefKind()) && hit.topologyRefId() > 0L) {
            return roomAreaById(snapshot, hit.topologyRefId());
        }
        if (hit.kind() == HitKind.LABEL && hit.clusterId() > 0L) {
            return snapshot.map().areas().stream()
                    .filter(area -> area.kind() == DungeonAreaKind.ROOM && area.clusterId() == hit.clusterId())
                    .findFirst()
                    .orElse(null);
        }
        return null;
    }

    private static @Nullable DungeonAreaSnapshot roomAreaById(DungeonSnapshot snapshot, long roomId) {
        if (snapshot == null || snapshot.map() == null || roomId <= 0L) {
            return null;
        }
        return snapshot.map().areas().stream()
                .filter(area -> area.kind() == DungeonAreaKind.ROOM && area.id() == roomId)
                .findFirst()
                .orElse(null);
    }

    private static DungeonCellRef corridorRoomCell(DungeonAreaSnapshot room, int pointerQ, int pointerR) {
        return room.cells().stream()
                .min(java.util.Comparator
                        .comparingInt((DungeonCellRef cell) -> Math.abs(cell.q() - pointerQ) + Math.abs(cell.r() - pointerR))
                        .thenComparingInt(DungeonCellRef::r)
                        .thenComparingInt(DungeonCellRef::q))
                .orElse(new DungeonCellRef(pointerQ, pointerR, 0));
    }

    private static String corridorDirection(DungeonAreaSnapshot room, DungeonCellRef roomCell) {
        Set<CellKey> roomCells = room.cells().stream()
                .map(cell -> new CellKey(cell.q(), cell.r(), cell.level()))
                .collect(java.util.stream.Collectors.toCollection(java.util.LinkedHashSet::new));
        CellKey key = new CellKey(roomCell.q(), roomCell.r(), roomCell.level());
        for (Direction direction : Direction.values()) {
            if (!roomCells.contains(key.neighbor(direction))) {
                return direction.name();
            }
        }
        return "";
    }

    private static @Nullable BoundaryRoomTouch perimeterDoorRoomTouch(
            DungeonSnapshot snapshot,
            @Nullable BoundaryTarget boundary
    ) {
        if (snapshot == null
                || snapshot.map() == null
                || boundary == null
                || !boundary.present()
                || !"DOOR".equals(boundary.kind())) {
            return null;
        }
        List<DungeonCellRef> touchingCells = touchingCells(boundary.start().toDungeonCellRef(), boundary.end().toDungeonCellRef());
        List<BoundaryRoomTouch> touches = new ArrayList<>();
        for (DungeonAreaSnapshot area : snapshot.map().areas()) {
            if (area.kind() != DungeonAreaKind.ROOM) {
                continue;
            }
            for (DungeonCellRef cell : area.cells()) {
                if (touchingCells.contains(cell)) {
                    touches.add(new BoundaryRoomTouch(area, cell));
                    break;
                }
            }
        }
        return touches.size() == 1 ? touches.getFirst() : null;
    }

    private static String boundaryDirectionForRoomCell(BoundaryTarget boundary, DungeonCellRef roomCell) {
        if (boundary == null || roomCell == null) {
            return "";
        }
        EdgeKey boundaryKey = EdgeKey.from(new DungeonEdgeRef(boundary.start().toDungeonCellRef(), boundary.end().toDungeonCellRef()));
        CellKey cellKey = new CellKey(roomCell.q(), roomCell.r(), roomCell.level());
        for (Direction direction : Direction.values()) {
            if (EdgeKey.sideOf(cellKey, direction).equals(boundaryKey)) {
                return direction.name();
            }
        }
        return "";
    }

    private static DungeonEditorSnapshot.Selection selectionForBoundary(BoundaryTarget boundary, long clusterId) {
        return new DungeonEditorSnapshot.Selection(
                new DungeonTopologyElementRef(
                        toPublishedTopologyKind(boundary.topologyRefKind()),
                        boundary.topologyRefId()),
                clusterId,
                false,
                null);
    }

    private static PointerState resolvePointerState(
            double canvasX,
            double canvasY,
            int level,
            boolean primaryButtonDown,
            boolean secondaryButtonDown,
            String hitRef
    ) {
        int q = (int) Math.floor(canvasX);
        int r = (int) Math.floor(canvasY);
        HitTarget hitTarget = parseHitTarget(hitRef);
        BoundaryTarget boundaryTarget = hitTarget.boundaryTarget();
        return new PointerState(
                q,
                r,
                level,
                primaryButtonDown,
                secondaryButtonDown,
                hitTarget,
                toVertexTarget(canvasX, canvasY, level),
                boundaryTarget == null ? BoundaryTarget.empty() : boundaryTarget);
    }

    private static VertexTarget toVertexTarget(double canvasX, double canvasY, int level) {
        int vertexQ = (int) Math.round(canvasX);
        int vertexR = (int) Math.round(canvasY);
        double distance = Math.hypot(canvasX - vertexQ, canvasY - vertexR);
        return distance <= 0.22
                ? new VertexTarget(true, vertexQ, vertexR, level)
                : VertexTarget.empty();
    }

    private static HitTarget parseHitTarget(String hitRef) {
        if (hitRef == null || hitRef.isBlank()) {
            return HitTarget.empty();
        }
        String[] parts = hitRef.split(":", -1);
        if (parts.length < 2) {
            return HitTarget.empty();
        }
        return switch (parts[0]) {
            case "cell" -> new HitTarget(
                    toHitKind(parts[1]),
                    parseLong(parts, 2),
                    parseLong(parts, 3),
                    part(parts, 4),
                    parseLong(parts, 5),
                    HandleTarget.empty(),
                    BoundaryTarget.empty());
            case "label" -> new HitTarget(
                    HitKind.LABEL,
                    parseLong(parts, 1),
                    parseLong(parts, 2),
                    part(parts, 3),
                    parseLong(parts, 4),
                    HandleTarget.clusterLabel(part(parts, 3), parseLong(parts, 4), parseLong(parts, 1), parseLong(parts, 2)),
                    BoundaryTarget.empty());
            case "marker" -> {
                HandleTarget handleTarget = new HandleTarget(
                        part(parts, 1),
                        part(parts, 2),
                        parseLong(parts, 3),
                        parseLong(parts, 4),
                        parseLong(parts, 5),
                        parseLong(parts, 6),
                        parseLong(parts, 7),
                        parseInt(parts, 8),
                        new CellTarget(parseInt(parts, 9), parseInt(parts, 10), parseInt(parts, 11)),
                        part(parts, 12));
                yield new HitTarget(
                        HitKind.HANDLE,
                        handleTarget.ownerId(),
                        handleTarget.clusterId(),
                        handleTarget.topologyRefKind(),
                        handleTarget.topologyRefId(),
                        handleTarget,
                        BoundaryTarget.empty());
            }
            case "edge" -> {
                BoundaryTarget boundaryTarget = new BoundaryTarget(
                        true,
                        part(parts, 1),
                        parseLong(parts, 2),
                        0L,
                        part(parts, 3),
                        parseLong(parts, 4),
                        new CellTarget(parseInt(parts, 6), parseInt(parts, 7), parseInt(parts, 5)),
                        new CellTarget(parseInt(parts, 8), parseInt(parts, 9), parseInt(parts, 5)));
                yield new HitTarget(
                        HitKind.BOUNDARY,
                        boundaryTarget.ownerId(),
                        0L,
                        boundaryTarget.topologyRefKind(),
                        boundaryTarget.topologyRefId(),
                        HandleTarget.clusterLabel(boundaryTarget.topologyRefKind(),
                                boundaryTarget.topologyRefId(),
                                boundaryTarget.ownerId(),
                                0L),
                        boundaryTarget);
            }
            case "graph-node" -> new HitTarget(
                    HitKind.LABEL,
                    parseLong(parts, 2),
                    parseLong(parts, 3),
                    part(parts, 1),
                    parseLong(parts, 2),
                    HandleTarget.clusterLabel(part(parts, 1), parseLong(parts, 2), parseLong(parts, 2), parseLong(parts, 3)),
                    BoundaryTarget.empty());
            default -> HitTarget.empty();
        };
    }

    private static String part(String[] parts, int index) {
        return index >= 0 && index < parts.length ? parts[index] : "";
    }

    private static long parseLong(String[] parts, int index) {
        try {
            return Long.parseLong(part(parts, index));
        } catch (NumberFormatException ignored) {
            return 0L;
        }
    }

    private static int parseInt(String[] parts, int index) {
        try {
            return Integer.parseInt(part(parts, index));
        } catch (NumberFormatException ignored) {
            return 0;
        }
    }

    private static HitKind toHitKind(String kind) {
        return switch (kind == null ? "" : kind) {
            case "ROOM" -> HitKind.ROOM;
            case "CORRIDOR" -> HitKind.CORRIDOR;
            case "STAIR" -> HitKind.STAIR;
            case "TRANSITION" -> HitKind.TRANSITION;
            default -> HitKind.EMPTY;
        };
    }

    private static boolean selectableHit(@Nullable HitTarget hit) {
        return hit != null
                && hit.kind() != HitKind.EMPTY
                && hit.topologyRefId() > 0L
                && !"EMPTY".equals(hit.topologyRefKind());
    }

    private static boolean draggableHit(HitTarget hit) {
        return hit != null
                && (hit.kind() == HitKind.HANDLE || hit.kind() == HitKind.LABEL)
                && (hit.clusterId() > 0L || hit.handleRef().ownerId() > 0L);
    }

    private static boolean clusterSelection(HitTarget hit) {
        return hit.kind() == HitKind.LABEL || hit.handleRef().clusterLabel();
    }

    private static DungeonEditorHandleRef dragHandleRef(HitTarget hit) {
        if (hit.kind() == HitKind.HANDLE) {
            return hit.handleRef().toDungeonHandleRef();
        }
        return HandleTarget.clusterLabel(
                hit.topologyRefKind(),
                hit.topologyRefId(),
                hit.ownerId(),
                hit.clusterId()).toDungeonHandleRef();
    }

    private static boolean selectionToolSelected(String selectedTool) {
        return "Auswahl".equals(normalizeTool(selectedTool));
    }

    private static boolean boundaryToolSelected(String selectedTool) {
        return "Wand setzen".equals(selectedTool)
                || "Wand loeschen".equals(selectedTool)
                || "Tuer setzen".equals(selectedTool)
                || "Tuer loeschen".equals(selectedTool);
    }

    private static boolean corridorToolSelected(String selectedTool) {
        return "Korridor erstellen".equals(selectedTool) || "Korridor loeschen".equals(selectedTool);
    }

    private static boolean roomPaintToolSelected(String selectedTool) {
        return "Raum malen".equals(selectedTool) || "Raum loeschen".equals(selectedTool);
    }

    private static String normalizeTool(String selectedTool) {
        return selectedTool == null || selectedTool.isBlank() ? "Auswahl" : selectedTool;
    }

    private static List<DungeonCellRef> touchingCells(DungeonCellRef start, DungeonCellRef end) {
        if (start == null || end == null || start.level() != end.level()) {
            return List.of();
        }
        if (start.r() == end.r()) {
            return horizontalTouchingCells(start, end);
        }
        if (start.q() == end.q()) {
            return verticalTouchingCells(start, end);
        }
        return List.of();
    }

    private static List<DungeonCellRef> horizontalTouchingCells(DungeonCellRef start, DungeonCellRef end) {
        int minQ = Math.min(start.q(), end.q());
        int maxQ = Math.max(start.q(), end.q());
        List<DungeonCellRef> result = new ArrayList<>();
        for (int q = minQ; q < maxQ; q++) {
            result.add(new DungeonCellRef(q, start.r() - 1, start.level()));
            result.add(new DungeonCellRef(q, start.r(), start.level()));
        }
        return List.copyOf(result);
    }

    private static List<DungeonCellRef> verticalTouchingCells(DungeonCellRef start, DungeonCellRef end) {
        int minR = Math.min(start.r(), end.r());
        int maxR = Math.max(start.r(), end.r());
        List<DungeonCellRef> result = new ArrayList<>();
        for (int r = minR; r < maxR; r++) {
            result.add(new DungeonCellRef(start.q() - 1, r, start.level()));
            result.add(new DungeonCellRef(start.q(), r, start.level()));
        }
        return List.copyOf(result);
    }

    private static src.domain.dungeon.published.DungeonTopologyElementKind toPublishedTopologyKind(String kind) {
        try {
            return src.domain.dungeon.published.DungeonTopologyElementKind.valueOf(kind);
        } catch (IllegalArgumentException ignored) {
            return src.domain.dungeon.published.DungeonTopologyElementKind.EMPTY;
        }
    }

    public record Effect(
            DungeonEditorSnapshot.@Nullable Selection selection,
            boolean clearSelection,
            @Nullable DungeonEditorOperation previewOperation,
            boolean clearPreview,
            @Nullable DungeonEditorOperation applyOperation,
            int projectionLevelDelta,
            @Nullable String statusText
    ) {
        static Effect none() {
            return new Effect(null, false, null, false, null, 0, null);
        }

        static Effect preview(DungeonEditorOperation operation) {
            return new Effect(null, false, operation, false, null, 0, null);
        }

        static Effect apply(DungeonEditorOperation operation) {
            return new Effect(null, false, null, true, operation, 0, null);
        }

        static Effect applyWithStatus(DungeonEditorOperation operation, String statusText) {
            return new Effect(null, false, null, true, operation, 0, statusText);
        }

        static Effect select(DungeonEditorSnapshot.Selection selection) {
            return new Effect(selection, false, null, true, null, 0, null);
        }

        static Effect select(DungeonEditorSnapshot.Selection selection, String statusText) {
            return new Effect(selection, false, null, true, null, 0, statusText);
        }

        static Effect clearedSelection() {
            return new Effect(null, true, null, true, null, 0, null);
        }

        static Effect projectionLevel(int delta) {
            return new Effect(null, false, null, false, null, delta, null);
        }

        static Effect clearPreviewIfNeeded(boolean clearPreview) {
            return new Effect(null, false, null, clearPreview, null, 0, null);
        }

        boolean isNoop() {
            return !clearSelection
                    && selection == null
                    && previewOperation == null
                    && !clearPreview
                    && applyOperation == null
                    && projectionLevelDelta == 0
                    && statusText == null;
        }
    }

    enum HitKind {
        EMPTY,
        HANDLE,
        LABEL,
        BOUNDARY,
        ROOM,
        CORRIDOR,
        STAIR,
        TRANSITION
    }

    record CellTarget(int q, int r, int level) {
        static CellTarget empty() {
            return new CellTarget(0, 0, 0);
        }

        DungeonCellRef toDungeonCellRef() {
            return new DungeonCellRef(q, r, level);
        }
    }

    record HandleTarget(
            String kind,
            String topologyRefKind,
            long topologyRefId,
            long ownerId,
            long clusterId,
            long corridorId,
            long roomId,
            int orderIndex,
            CellTarget anchor,
            String direction
    ) {
        HandleTarget {
            kind = kind == null || kind.isBlank() ? "CLUSTER_LABEL" : kind;
            topologyRefKind = topologyRefKind == null || topologyRefKind.isBlank() ? "EMPTY" : topologyRefKind.trim();
            topologyRefId = Math.max(0L, topologyRefId);
            ownerId = Math.max(0L, ownerId);
            clusterId = Math.max(0L, clusterId);
            corridorId = Math.max(0L, corridorId);
            roomId = Math.max(0L, roomId);
            orderIndex = Math.max(0, orderIndex);
            anchor = anchor == null ? CellTarget.empty() : anchor;
            direction = direction == null ? "" : direction;
        }

        static HandleTarget empty() {
            return new HandleTarget("CLUSTER_LABEL", "EMPTY", 0L, 0L, 0L, 0L, 0L, 0, CellTarget.empty(), "");
        }

        static HandleTarget clusterLabel(String topologyRefKind, long topologyRefId, long ownerId, long clusterId) {
            return new HandleTarget(
                    "CLUSTER_LABEL",
                    topologyRefKind,
                    topologyRefId,
                    ownerId,
                    clusterId,
                    0L,
                    0L,
                    0,
                    CellTarget.empty(),
                    "");
        }

        boolean clusterLabel() {
            return "CLUSTER_LABEL".equals(kind);
        }

        DungeonEditorHandleRef toDungeonHandleRef() {
            return new DungeonEditorHandleRef(
                    DungeonEditorHandleKind.valueOf(kind),
                    new DungeonTopologyElementRef(toPublishedTopologyKind(topologyRefKind), topologyRefId),
                    ownerId,
                    clusterId,
                    corridorId,
                    roomId,
                    orderIndex,
                    anchor.toDungeonCellRef(),
                    direction);
        }
    }

    record BoundaryTarget(
            boolean present,
            String kind,
            long ownerId,
            long clusterId,
            String topologyRefKind,
            long topologyRefId,
            CellTarget start,
            CellTarget end
    ) {
        BoundaryTarget {
            kind = kind == null || kind.isBlank() ? "WALL" : kind;
            ownerId = Math.max(0L, ownerId);
            clusterId = Math.max(0L, clusterId);
            topologyRefKind = topologyRefKind == null || topologyRefKind.isBlank() ? "EMPTY" : topologyRefKind;
            topologyRefId = Math.max(0L, topologyRefId);
            start = start == null ? CellTarget.empty() : start;
            end = end == null ? CellTarget.empty() : end;
        }

        static BoundaryTarget empty() {
            return new BoundaryTarget(false, "WALL", 0L, 0L, "EMPTY", 0L, CellTarget.empty(), CellTarget.empty());
        }
    }

    record HitTarget(
            HitKind kind,
            long ownerId,
            long clusterId,
            String topologyRefKind,
            long topologyRefId,
            HandleTarget handleRef,
            BoundaryTarget boundaryTarget
    ) {
        HitTarget {
            kind = kind == null ? HitKind.EMPTY : kind;
            ownerId = Math.max(0L, ownerId);
            clusterId = Math.max(0L, clusterId);
            topologyRefKind = topologyRefKind == null || topologyRefKind.isBlank() ? "EMPTY" : topologyRefKind.trim();
            topologyRefId = Math.max(0L, topologyRefId);
            handleRef = handleRef == null
                    ? HandleTarget.clusterLabel(topologyRefKind, topologyRefId, ownerId, clusterId)
                    : handleRef;
            boundaryTarget = boundaryTarget == null ? BoundaryTarget.empty() : boundaryTarget;
        }

        static HitTarget empty() {
            return new HitTarget(HitKind.EMPTY, 0L, 0L, "EMPTY", 0L, HandleTarget.empty(), BoundaryTarget.empty());
        }
    }

    record PointerState(
            int q,
            int r,
            int level,
            boolean primaryButtonDown,
            boolean secondaryButtonDown,
            HitTarget hitTarget,
            VertexTarget vertexTarget,
            BoundaryTarget boundaryTarget
    ) {
        PointerState {
            hitTarget = hitTarget == null ? HitTarget.empty() : hitTarget;
            vertexTarget = vertexTarget == null ? VertexTarget.empty() : vertexTarget;
            boundaryTarget = boundaryTarget == null ? BoundaryTarget.empty() : boundaryTarget;
        }
    }

    record VertexTarget(boolean present, int q, int r, int level) {
        static VertexTarget empty() {
            return new VertexTarget(false, 0, 0, 0);
        }
    }

    private record PaintSession(
            int startQ,
            int startR,
            int endQ,
            int endR,
            int level,
            boolean deleteMode
    ) {
        PaintSession withEnd(int nextEndQ, int nextEndR) {
            return new PaintSession(startQ, startR, nextEndQ, nextEndR, level, deleteMode);
        }
    }

    private record DragSession(
            DungeonEditorSnapshot.Selection selection,
            int pressQ,
            int pressR,
            int currentQ,
            int currentR,
            int pressLevel,
            int currentLevel
    ) {
        static DragSession start(
                DungeonEditorSnapshot.Selection selection,
                int pressQ,
                int pressR,
                int pressLevel
        ) {
            return new DragSession(selection, pressQ, pressR, pressQ, pressR, pressLevel, pressLevel);
        }

        int deltaQ() {
            return currentQ - pressQ;
        }

        int deltaR() {
            return currentR - pressR;
        }

        int deltaLevel() {
            return currentLevel - pressLevel;
        }

        boolean moved() {
            return deltaQ() != 0 || deltaR() != 0 || deltaLevel() != 0;
        }

        DragSession withCurrentPointer(int nextQ, int nextR) {
            return new DragSession(selection, pressQ, pressR, nextQ, nextR, pressLevel, currentLevel);
        }

        DragSession withCurrentLevel(int nextLevel) {
            return new DragSession(selection, pressQ, pressR, currentQ, currentR, pressLevel, nextLevel);
        }
    }

    private enum BoundaryStretchOrientation {
        HORIZONTAL,
        VERTICAL;

        private static @Nullable BoundaryStretchOrientation from(BoundaryTarget boundaryTarget) {
            if (boundaryTarget == null || !boundaryTarget.present()) {
                return null;
            }
            if (boundaryTarget.start().q() == boundaryTarget.end().q()) {
                return VERTICAL;
            }
            if (boundaryTarget.start().r() == boundaryTarget.end().r()) {
                return HORIZONTAL;
            }
            return null;
        }
    }

    private record BoundaryStretchSession(
            DungeonEditorSnapshot.Selection selection,
            long clusterId,
            List<DungeonEdgeRef> sourceEdges,
            BoundaryStretchOrientation orientation,
            int pressQ,
            int pressR,
            int pressLevel,
            int currentQ,
            int currentR
    ) {
        BoundaryStretchSession {
            sourceEdges = sourceEdges == null ? List.of() : List.copyOf(sourceEdges);
            orientation = orientation == null ? BoundaryStretchOrientation.VERTICAL : orientation;
        }

        BoundaryStretchSession withCurrentPointer(int nextQ, int nextR) {
            return new BoundaryStretchSession(
                    selection,
                    clusterId,
                    sourceEdges,
                    orientation,
                    pressQ,
                    pressR,
                    pressLevel,
                    nextQ,
                    nextR);
        }

        int deltaQ() {
            return orientation == BoundaryStretchOrientation.VERTICAL ? currentQ - pressQ : 0;
        }

        int deltaR() {
            return orientation == BoundaryStretchOrientation.HORIZONTAL ? currentR - pressR : 0;
        }

        int deltaLevel() {
            return 0;
        }

        boolean moved() {
            return deltaQ() != 0 || deltaR() != 0;
        }
    }

    private record BoundaryDraft(
            long clusterId,
            boolean deleteMode,
            VertexKey startVertex,
            VertexKey currentVertex,
            Set<EdgeKey> previewEdges
    ) {
        private BoundaryDraft {
            previewEdges = previewEdges == null ? Set.of() : Set.copyOf(previewEdges);
        }
    }

    private record CorridorDraft(PendingCorridorTarget start) {
    }

    private sealed interface PendingCorridorTarget permits PendingCorridorTarget.EndpointTarget {
        String targetKey();

        String displayLabel();

        DungeonEditorSnapshot.Selection selection();

        long deleteCorridorId();

        DungeonEditorOperation.CorridorEndpoint endpoint();

        record EndpointTarget(
                String targetKey,
                String displayLabel,
                DungeonEditorSnapshot.Selection selection,
                long deleteCorridorId,
                DungeonEditorOperation.CorridorEndpoint endpoint
        ) implements PendingCorridorTarget {
        }
    }

    private record BoundaryRoomTouch(
            DungeonAreaSnapshot room,
            DungeonCellRef roomCell
    ) {
    }

    private record PathResult(List<EdgeKey> routeEdges, Set<EdgeKey> committedEdges) {
        private PathResult {
            routeEdges = routeEdges == null ? List.of() : List.copyOf(routeEdges);
            committedEdges = committedEdges == null ? Set.of() : Set.copyOf(committedEdges);
        }

        static PathResult empty() {
            return new PathResult(List.of(), Set.of());
        }

        boolean hasRoute() {
            return !routeEdges.isEmpty();
        }
    }

    private record CellKey(int q, int r, int level) {
        CellKey neighbor(Direction direction) {
            return new CellKey(q + direction.deltaQ(), r + direction.deltaR(), level);
        }
    }

    private record VertexKey(int q, int r, int level) {
        private static final java.util.Comparator<VertexKey> ORDER = java.util.Comparator
                .comparingInt(VertexKey::level)
                .thenComparingInt(VertexKey::r)
                .thenComparingInt(VertexKey::q);
    }

    private record EdgeKey(VertexKey start, VertexKey end) {
        static EdgeKey from(DungeonEdgeRef edge) {
            return between(
                    new VertexKey(edge.from().q(), edge.from().r(), edge.from().level()),
                    new VertexKey(edge.to().q(), edge.to().r(), edge.to().level()));
        }

        static EdgeKey between(VertexKey first, VertexKey second) {
            return VertexKey.ORDER.compare(first, second) <= 0
                    ? new EdgeKey(first, second)
                    : new EdgeKey(second, first);
        }

        static EdgeKey sideOf(CellKey cell, Direction direction) {
            return switch (direction) {
                case NORTH -> between(
                        new VertexKey(cell.q(), cell.r(), cell.level()),
                        new VertexKey(cell.q() + 1, cell.r(), cell.level()));
                case EAST -> between(
                        new VertexKey(cell.q() + 1, cell.r(), cell.level()),
                        new VertexKey(cell.q() + 1, cell.r() + 1, cell.level()));
                case SOUTH -> between(
                        new VertexKey(cell.q(), cell.r() + 1, cell.level()),
                        new VertexKey(cell.q() + 1, cell.r() + 1, cell.level()));
                case WEST -> between(
                        new VertexKey(cell.q(), cell.r(), cell.level()),
                        new VertexKey(cell.q(), cell.r() + 1, cell.level()));
            };
        }

        boolean touches(VertexKey vertex) {
            return start.equals(vertex) || end.equals(vertex);
        }

        DungeonEdgeRef toEdgeRef() {
            return new DungeonEdgeRef(
                    new DungeonCellRef(start.q(), start.r(), start.level()),
                    new DungeonCellRef(end.q(), end.r(), end.level()));
        }
    }

    private enum Direction {
        NORTH(0, -1),
        EAST(1, 0),
        SOUTH(0, 1),
        WEST(-1, 0);

        private final int deltaQ;
        private final int deltaR;

        Direction(int deltaQ, int deltaR) {
            this.deltaQ = deltaQ;
            this.deltaR = deltaR;
        }

        int deltaQ() {
            return deltaQ;
        }

        int deltaR() {
            return deltaR;
        }
    }

    private static VertexKey vertexKey(VertexTarget vertex) {
        return new VertexKey(vertex.q(), vertex.r(), vertex.level());
    }

    private static DungeonEditorOperation moveHandleOperation(DragSession session) {
        DungeonEditorHandleRef handleRef = session.selection().handleRef() == null
                ? new DungeonEditorHandleRef(
                DungeonEditorHandleKind.CLUSTER_LABEL,
                session.selection().topologyRef(),
                0L,
                session.selection().clusterId(),
                0L,
                0L,
                0,
                new DungeonCellRef(0, 0, 0),
                "")
                : session.selection().handleRef();
        return new DungeonEditorOperation.MoveEditorHandle(
                handleRef,
                session.deltaQ(),
                session.deltaR(),
                session.deltaLevel());
    }
}
