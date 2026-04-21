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
import src.domain.dungeon.published.DungeonInspectorSnapshot;
import src.domain.dungeon.published.DungeonMapId;
import src.domain.dungeon.published.DungeonMapMode;
import src.domain.dungeon.published.DungeonMapSnapshot;
import src.domain.dungeon.published.DungeonMapSummary;
import src.domain.dungeon.published.DungeonOperationResult;
import src.domain.dungeon.published.DungeonSnapshot;
import src.domain.dungeon.published.DungeonTopologyKind;
import src.domain.dungeon.published.LoadDungeonSnapshotQuery;
import src.domain.dungeon.published.LoadMapSnapshotQuery;
import src.domain.dungeon.published.SearchMapsQuery;
import src.domain.dungeon.published.SearchMapsResult;
import src.domain.dungeon.application.ApplyDungeonEditorOperationUseCase;
import src.domain.dungeon.application.BuildDungeonDerivedStateUseCase;
import src.domain.dungeon.application.CreateDungeonMapUseCase;
import src.domain.dungeon.application.DeleteDungeonMapUseCase;
import src.domain.dungeon.application.LoadDungeonSnapshotUseCase;
import src.domain.dungeon.application.LoadMapSnapshotUseCase;
import src.domain.dungeon.application.SearchDungeonMapsUseCase;
import src.domain.dungeon.map.entity.DungeonAggregate;
import src.domain.dungeon.map.port.DungeonMapRepository;
import src.domain.dungeon.map.port.DungeonMapSearch;
import src.domain.dungeon.map.value.DungeonAreaFacts;
import src.domain.dungeon.map.value.DungeonAreaType;
import src.domain.dungeon.map.value.DungeonBoundaryFacts;
import src.domain.dungeon.map.value.DungeonCell;
import src.domain.dungeon.map.value.DungeonEdge;
import src.domain.dungeon.map.value.DungeonMapFacts;
import src.domain.dungeon.map.value.DungeonMapIdentity;
import src.domain.dungeon.map.value.DungeonTopology;

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
    }

    public DungeonSnapshot loadSnapshot(LoadDungeonSnapshotQuery query) {
        return toPublishedSnapshot(loadDungeonSnapshotUseCase.execute());
    }

    public DungeonOperationResult applyOperation(ApplyDungeonEditorOperationCommand command) {
        DungeonEditorOperation operation = command == null ? null : command.operation();
        ApplyDungeonEditorOperationUseCase.OperationResultData result =
                applyDungeonEditorOperationUseCase.execute(toOperationInput(operation));
        return new DungeonOperationResult(
                toPublishedSnapshot(result.snapshot()),
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
                .map(summary -> new DungeonMapSummary(
                        toPublishedId(summary.mapId()),
                        summary.mapName(),
                        summary.revision()))
                .toList();
        return new SearchMapsResult(maps);
    }

    public CreateDungeonMapResult createMap(CreateDungeonMapCommand command) {
        String mapName = command == null ? "" : command.mapName();
        CreateDungeonMapUseCase.CreatedMap result = createDungeonMapUseCase.execute(mapName);
        return new CreateDungeonMapResult(toPublishedId(result.mapId()));
    }

    public DeleteDungeonMapResult deleteMap(DeleteDungeonMapCommand command) {
        DungeonMapId mapId = command == null ? new DungeonMapId(1L) : command.mapId();
        return new DeleteDungeonMapResult(toPublishedId(
                deleteDungeonMapUseCase.execute(toDomainIdentity(mapId))));
    }

    public BaseMapSnapshot loadMapSnapshot(LoadMapSnapshotQuery query) {
        LoadMapSnapshotQuery effectiveQuery = query == null
                ? new LoadMapSnapshotQuery(new DungeonMapId(1L), 0)
                : query;
        LoadMapSnapshotUseCase.MapSnapshotData snapshot = loadMapSnapshotUseCase.execute(
                toDomainIdentity(effectiveQuery.mapId()),
                effectiveQuery.targetFloor());
        return new BaseMapSnapshot(
                toPublishedId(snapshot.mapId()),
                snapshot.mapName(),
                snapshot.revision(),
                snapshot.targetFloor(),
                toPublishedMapSnapshot(snapshot.map()),
                snapshot.empty());
    }

    private DungeonSnapshot toPublishedSnapshot(LoadDungeonSnapshotUseCase.DungeonSnapshotData snapshot) {
        return new DungeonSnapshot(
                snapshot.mapName(),
                DungeonMapMode.EDITOR,
                toPublishedMapSnapshot(snapshot.derived().map()),
                snapshot.derived().aggregates().stream().map(DungeonApplicationService::aggregateSummary).toList(),
                snapshot.derived().relations().connections().stream()
                        .map(connection -> "corridor " + connection.corridorId() + " -> room " + connection.roomId()
                                + " (" + connection.direction() + ")")
                        .toList(),
                toPublishedRevision(snapshot.revision()));
    }

    private static ApplyDungeonEditorOperationUseCase.OperationInput toOperationInput(@Nullable DungeonEditorOperation operation) {
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

    private static DungeonMapSnapshot toPublishedMapSnapshot(DungeonMapFacts facts) {
        DungeonMapFacts safeFacts = facts == null
                ? new DungeonMapFacts(DungeonTopology.SQUARE, 1, 1, List.of(), List.of())
                : facts;
        return new DungeonMapSnapshot(
                toPublishedTopology(safeFacts.topology()),
                safeFacts.width(),
                safeFacts.height(),
                safeFacts.areas().stream().map(DungeonApplicationService::toPublishedArea).toList(),
                safeFacts.boundaries().stream().map(DungeonApplicationService::toPublishedBoundary).toList());
    }

    private static DungeonMapId toPublishedId(DungeonMapIdentity identity) {
        return new DungeonMapId(identity == null ? 1L : identity.value());
    }

    private static DungeonMapIdentity toDomainIdentity(DungeonMapId mapId) {
        return new DungeonMapIdentity(mapId == null ? 1L : mapId.value());
    }

    private static DungeonAreaSnapshot toPublishedArea(DungeonAreaFacts area) {
        return new DungeonAreaSnapshot(
                toPublishedAreaKind(area.kind()),
                area.id(),
                area.label(),
                area.cells().stream().map(DungeonApplicationService::toPublishedCell).toList());
    }

    private static DungeonBoundarySnapshot toPublishedBoundary(DungeonBoundaryFacts boundary) {
        return new DungeonBoundarySnapshot(
                boundary.kind(),
                boundary.id(),
                boundary.label(),
                toPublishedEdge(boundary.edge()));
    }

    private static DungeonAreaKind toPublishedAreaKind(DungeonAreaType kind) {
        return kind == DungeonAreaType.CORRIDOR ? DungeonAreaKind.CORRIDOR : DungeonAreaKind.ROOM;
    }

    private static DungeonTopologyKind toPublishedTopology(DungeonTopology topology) {
        return topology == DungeonTopology.HEX ? DungeonTopologyKind.HEX : DungeonTopologyKind.SQUARE;
    }

    private static DungeonCellRef toPublishedCell(DungeonCell cell) {
        return new DungeonCellRef(cell.q(), cell.r(), cell.level());
    }

    private static DungeonEdgeRef toPublishedEdge(DungeonEdge edge) {
        return new DungeonEdgeRef(toPublishedCell(edge.from()), toPublishedCell(edge.to()));
    }

    private static String aggregateSummary(DungeonAggregate aggregate) {
        return aggregate.label() + " #" + aggregate.id();
    }

    private static int toPublishedRevision(long revision) {
        if (revision > Integer.MAX_VALUE) {
            return Integer.MAX_VALUE;
        }
        return Math.max(0, (int) revision);
    }
}
