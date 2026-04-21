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
import src.domain.dungeon.published.DungeonBoundarySnapshot;
import src.domain.dungeon.published.DungeonCellRef;
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
import src.domain.dungeon.published.DungeonTravelActionKind;
import src.domain.dungeon.published.DungeonTravelActionSnapshot;
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
import src.domain.dungeon.application.SearchDungeonMapsUseCase;
import src.domain.dungeon.map.entity.DungeonAggregate;
import src.domain.dungeon.map.port.DungeonMapRepository;
import src.domain.dungeon.map.port.DungeonMapSearch;
import src.domain.dungeon.map.value.DungeonAreaFacts;
import src.domain.dungeon.map.value.DungeonAreaType;
import src.domain.dungeon.map.value.DungeonBoundaryFacts;
import src.domain.dungeon.map.value.DungeonCell;
import src.domain.dungeon.map.value.DungeonEdge;
import src.domain.dungeon.map.value.DungeonFeatureFacts;
import src.domain.dungeon.map.value.DungeonMapFacts;
import src.domain.dungeon.map.value.DungeonMapIdentity;
import src.domain.dungeon.map.value.DungeonTopology;
import src.domain.dungeon.map.value.DungeonTravelActionFacts;
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
        this.deleteDungeonMapUseCase = new DeleteDungeonMapUseCase(repository);
        this.loadMapSnapshotUseCase = new LoadMapSnapshotUseCase(repository, derive);
        this.loadDungeonTravelSurfaceUseCase = new LoadDungeonTravelSurfaceUseCase(repository, search, derive);
        this.moveDungeonTravelActionUseCase = new MoveDungeonTravelActionUseCase(repository, search, derive);
    }

    public DungeonSnapshot loadSnapshot(LoadDungeonSnapshotQuery query) {
        return PublishedTranslator.snapshot(loadDungeonSnapshotUseCase.execute());
    }

    public DungeonOperationResult applyOperation(ApplyDungeonEditorOperationCommand command) {
        DungeonEditorOperation operation = command == null ? null : command.operation();
        ApplyDungeonEditorOperationUseCase.OperationResultData result =
                applyDungeonEditorOperationUseCase.execute(PublishedTranslator.operationInput(operation));
        return new DungeonOperationResult(
                PublishedTranslator.snapshot(result.snapshot()),
                result.validationMessages(),
                result.reactionMessages());
    }

    public DungeonInspectorSnapshot describeSelection(DescribeDungeonSelectionQuery query) {
        DescribeDungeonSelectionQuery effectiveQuery = query == null
                ? new DescribeDungeonSelectionQuery("", 0L)
                : query;
        LoadDungeonSnapshotUseCase.InspectorSnapshotData snapshot =
                loadDungeonSnapshotUseCase.describeSelection(effectiveQuery.ownerKind(), effectiveQuery.ownerId());
        return new DungeonInspectorSnapshot(snapshot.title(), snapshot.description(), snapshot.facts());
    }

    public SearchMapsResult searchMaps(SearchMapsQuery query) {
        String searchTerm = query == null ? "" : query.query();
        List<DungeonMapSummary> maps = searchDungeonMapsUseCase.execute(searchTerm).stream()
                .map(PublishedTranslator::mapSummary)
                .toList();
        return new SearchMapsResult(maps);
    }

    public CreateDungeonMapResult createMap(CreateDungeonMapCommand command) {
        String mapName = command == null ? "" : command.mapName();
        CreateDungeonMapUseCase.CreatedMap result = createDungeonMapUseCase.execute(mapName);
        return new CreateDungeonMapResult(PublishedTranslator.mapId(result.mapId()));
    }

    public DeleteDungeonMapResult deleteMap(DeleteDungeonMapCommand command) {
        DungeonMapId mapId = command == null ? new DungeonMapId(1L) : command.mapId();
        return new DeleteDungeonMapResult(PublishedTranslator.mapId(
                deleteDungeonMapUseCase.execute(PublishedTranslator.domainMapId(mapId))));
    }

    public BaseMapSnapshot loadMapSnapshot(LoadMapSnapshotQuery query) {
        LoadMapSnapshotQuery effectiveQuery = query == null
                ? new LoadMapSnapshotQuery(new DungeonMapId(1L), 0)
                : query;
        LoadMapSnapshotUseCase.MapSnapshotData snapshot = loadMapSnapshotUseCase.execute(
                PublishedTranslator.domainMapId(effectiveQuery.mapId()),
                effectiveQuery.targetFloor());
        return new BaseMapSnapshot(
                PublishedTranslator.mapId(snapshot.mapId()),
                snapshot.mapName(),
                snapshot.revision(),
                snapshot.targetFloor(),
                PublishedTranslator.mapSnapshot(snapshot.map()),
                snapshot.empty());
    }

    public DungeonTravelSurfaceSnapshot loadTravelSurface(LoadDungeonTravelSurfaceQuery query) {
        LoadDungeonTravelSurfaceQuery effectiveQuery = query == null
                ? new LoadDungeonTravelSurfaceQuery(null)
                : query;
        return PublishedTranslator.travelSurface(loadDungeonTravelSurfaceUseCase.execute(
                new LoadDungeonTravelSurfaceUseCase.Input(PublishedTranslator.travelPosition(effectiveQuery.position()))));
    }

    public DungeonTravelMoveResult moveTravelAction(MoveDungeonTravelActionCommand command) {
        MoveDungeonTravelActionCommand effectiveCommand = command == null
                ? new MoveDungeonTravelActionCommand(null, "")
                : command;
        DungeonTravelMoveFacts result = moveDungeonTravelActionUseCase.execute(new MoveDungeonTravelActionUseCase.Input(
                PublishedTranslator.travelPosition(effectiveCommand.position()),
                effectiveCommand.actionId()));
        return PublishedTranslator.travelMoveResult(result);
    }

    private static final class PublishedTranslator {

        private PublishedTranslator() {
        }

        private static DungeonSnapshot snapshot(LoadDungeonSnapshotUseCase.DungeonSnapshotData snapshot) {
            return new DungeonSnapshot(
                    snapshot.mapName(),
                    DungeonMapMode.EDITOR,
                    mapSnapshot(snapshot.derived().map()),
                    snapshot.derived().aggregates().stream().map(PublishedTranslator::aggregateSummary).toList(),
                    snapshot.derived().relations().summaries(),
                    revision(snapshot.revision()));
        }

        private static ApplyDungeonEditorOperationUseCase.OperationInput operationInput(
                @Nullable DungeonEditorOperation operation
        ) {
            if (operation instanceof DungeonEditorOperation.MoveRoomAnchor moveRoomAnchor) {
                return new ApplyDungeonEditorOperationUseCase.OperationInput.MoveRoomAnchor(
                        moveRoomAnchor.deltaQ(),
                        moveRoomAnchor.deltaR());
            }
            if (operation instanceof DungeonEditorOperation.ResetDemoLayout) {
                return new ApplyDungeonEditorOperationUseCase.OperationInput.ResetDemoLayout();
            }
            return new ApplyDungeonEditorOperationUseCase.OperationInput.NoChange();
        }

        private static DungeonMapSummary mapSummary(SearchDungeonMapsUseCase.MapSummary summary) {
            return new DungeonMapSummary(mapId(summary.mapId()), summary.mapName(), summary.revision());
        }

        private static DungeonMapSnapshot mapSnapshot(DungeonMapFacts facts) {
            DungeonMapFacts safeFacts = facts == null
                    ? new DungeonMapFacts(DungeonTopology.SQUARE, 1, 1, List.of(), List.of())
                    : facts;
            return new DungeonMapSnapshot(
                    topology(safeFacts.topology()),
                    safeFacts.width(),
                    safeFacts.height(),
                    safeFacts.areas().stream().map(PublishedTranslator::area).toList(),
                    safeFacts.boundaries().stream().map(PublishedTranslator::boundary).toList(),
                    safeFacts.features().stream().map(PublishedTranslator::feature).toList());
        }

        private static DungeonMapId mapId(DungeonMapIdentity identity) {
            return new DungeonMapId(identity == null ? 1L : identity.value());
        }

        private static DungeonMapIdentity domainMapId(DungeonMapId mapId) {
            return new DungeonMapIdentity(mapId == null ? 1L : mapId.value());
        }

        private static DungeonAreaSnapshot area(DungeonAreaFacts area) {
            return new DungeonAreaSnapshot(
                    areaKind(area.kind()),
                    area.id(),
                    area.label(),
                    area.cells().stream().map(PublishedTranslator::cell).toList());
        }

        private static DungeonBoundarySnapshot boundary(DungeonBoundaryFacts boundary) {
            return new DungeonBoundarySnapshot(
                    boundary.kind(),
                    boundary.id(),
                    boundary.label(),
                    edge(boundary.edge()));
        }

        private static DungeonFeatureSnapshot feature(DungeonFeatureFacts feature) {
            return new DungeonFeatureSnapshot(
                    DungeonFeatureKind.valueOf(feature.kind().name()),
                    feature.id(),
                    feature.label(),
                    feature.cells().stream().map(PublishedTranslator::cell).toList(),
                    feature.description(),
                    feature.destinationLabel());
        }

        private static DungeonTravelMoveResult travelMoveResult(DungeonTravelMoveFacts result) {
            return new DungeonTravelMoveResult(
                    DungeonTravelMoveStatus.valueOf(result.status().name()),
                    result.message(),
                    travelSurface(result.surface()));
        }

        private static DungeonTravelSurfaceSnapshot travelSurface(DungeonTravelSurfaceFacts surface) {
            return new DungeonTravelSurfaceSnapshot(
                    surface.mapName(),
                    revision(surface.revision()),
                    mapSnapshot(surface.map()),
                    travelPosition(surface.position()),
                    surface.surfaceTitle(),
                    surface.areaLabel(),
                    surface.tileLabel(),
                    surface.headingLabel(),
                    surface.statusLabel(),
                    surface.visualDescription(),
                    surface.actions().stream().map(PublishedTranslator::travelAction).toList());
        }

        private static DungeonTravelActionSnapshot travelAction(DungeonTravelActionFacts action) {
            return new DungeonTravelActionSnapshot(
                    action.actionId(),
                    DungeonTravelActionKind.valueOf(action.kind().name()),
                    action.label(),
                    action.destinationLabel(),
                    action.description());
        }

        private static DungeonTravelPosition travelPosition(DungeonTravelPositionFacts position) {
            return new DungeonTravelPosition(
                    mapId(position.mapId()),
                    DungeonTravelLocationKind.valueOf(position.locationKind().name()),
                    position.ownerId(),
                    cell(position.tile()),
                    DungeonTravelHeading.valueOf(position.heading().name()));
        }

        private static @Nullable DungeonTravelPositionFacts travelPosition(@Nullable DungeonTravelPosition position) {
            if (position == null) {
                return null;
            }
            return new DungeonTravelPositionFacts(
                    domainMapId(position.mapId()),
                    src.domain.dungeon.map.value.DungeonTravelLocationKind.valueOf(position.locationKind().name()),
                    position.ownerId(),
                    domainCell(position.tile()),
                    src.domain.dungeon.map.value.DungeonTravelHeading.valueOf(position.heading().name()));
        }

        private static DungeonAreaKind areaKind(DungeonAreaType kind) {
            return kind == DungeonAreaType.CORRIDOR ? DungeonAreaKind.CORRIDOR : DungeonAreaKind.ROOM;
        }

        private static DungeonTopologyKind topology(DungeonTopology topology) {
            return topology == DungeonTopology.HEX ? DungeonTopologyKind.HEX : DungeonTopologyKind.SQUARE;
        }

        private static DungeonCellRef cell(DungeonCell cell) {
            return new DungeonCellRef(cell.q(), cell.r(), cell.level());
        }

        private static DungeonCell domainCell(DungeonCellRef cell) {
            return new DungeonCell(cell.q(), cell.r(), cell.level());
        }

        private static DungeonEdgeRef edge(DungeonEdge edge) {
            return new DungeonEdgeRef(cell(edge.from()), cell(edge.to()));
        }

        private static String aggregateSummary(DungeonAggregate aggregate) {
            return aggregate.label() + " #" + aggregate.id();
        }

        private static int revision(long revision) {
            if (revision > Integer.MAX_VALUE) {
                return Integer.MAX_VALUE;
            }
            return Math.max(0, (int) revision);
        }
    }
}
