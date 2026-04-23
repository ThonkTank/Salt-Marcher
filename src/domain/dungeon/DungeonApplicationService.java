package src.domain.dungeon;

import org.jspecify.annotations.Nullable;
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
import src.domain.dungeon.published.DungeonTopologyKind;
import src.domain.dungeon.published.DungeonTopologyElementRef;
import src.domain.dungeon.published.DungeonTravelActionKind;
import src.domain.dungeon.published.DungeonTravelActionSnapshot;
import src.domain.dungeon.published.DungeonTravelExternalTarget;
import src.domain.dungeon.published.DungeonTravelHeading;
import src.domain.dungeon.published.DungeonTravelLocationKind;
import src.domain.dungeon.published.DungeonTravelMoveResult;
import src.domain.dungeon.published.DungeonTravelMoveStatus;
import src.domain.dungeon.published.DungeonTravelPosition;
import src.domain.dungeon.published.DungeonTravelSurfaceSnapshot;
import src.domain.dungeon.published.LoadDungeonSnapshotQuery;
import src.domain.dungeon.published.LoadMapSnapshotQuery;
import src.domain.dungeon.published.LoadDungeonTravelSurfaceQuery;
import src.domain.dungeon.published.MoveDungeonTravelActionCommand;
import src.domain.dungeon.published.PreviewDungeonEditorOperationQuery;
import src.domain.dungeon.published.RenameDungeonMapCommand;
import src.domain.dungeon.published.RenameDungeonMapResult;
import src.domain.dungeon.published.SearchMapsQuery;
import src.domain.dungeon.published.SearchMapsResult;
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

import java.util.List;
import java.util.Objects;

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
    }

    public DungeonSnapshot loadSnapshot(LoadDungeonSnapshotQuery query) {
        LoadDungeonSnapshotQuery effectiveQuery = query == null ? new LoadDungeonSnapshotQuery() : query;
        return SnapshotPublication.snapshot(loadDungeonSnapshotUseCase.execute(
                MapPublication.domainId(effectiveQuery.mapId())));
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
        return TravelPublication.surface(loadDungeonTravelSurfaceUseCase.execute(
                new LoadDungeonTravelSurfaceUseCase.Input(TravelPublication.position(effectiveQuery.position()))));
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
            if (operation instanceof DungeonEditorOperation.SaveRoomNarration saveRoomNarration) {
                return new ApplyDungeonEditorOperationUseCase.OperationInput.SaveRoomNarration(
                        saveRoomNarration.roomId(),
                        saveRoomNarration.visualDescription(),
                        saveRoomNarration.exits().stream().map(MapPublication::domainExitNarration).toList());
            }
            return new ApplyDungeonEditorOperationUseCase.OperationInput.NoChange();
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
                    surface(result.surface()),
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

        private static DungeonTravelSurfaceSnapshot surface(DungeonTravelSurfaceFacts surface) {
            return new DungeonTravelSurfaceSnapshot(
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
