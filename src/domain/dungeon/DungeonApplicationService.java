package src.domain.dungeon;

import src.domain.dungeon.published.BaseMapSnapshot;
import src.domain.dungeon.published.CreateDungeonMapCommand;
import src.domain.dungeon.published.CreateDungeonMapResult;
import src.domain.dungeon.published.DeleteDungeonMapCommand;
import src.domain.dungeon.published.DeleteDungeonMapResult;
import src.domain.dungeon.published.DungeonEditorOperation;
import src.domain.dungeon.published.DungeonInspectorSnapshot;
import src.domain.dungeon.published.DungeonMapId;
import src.domain.dungeon.published.DungeonMapMode;
import src.domain.dungeon.published.DungeonMapSummary;
import src.domain.dungeon.published.DungeonOperationResult;
import src.domain.dungeon.published.DungeonSnapshot;
import src.domain.dungeon.published.LoadMapSnapshotQuery;
import src.domain.dungeon.published.SearchMapsQuery;
import src.domain.dungeon.application.ApplyDungeonEditorOperationUseCase;
import src.domain.dungeon.application.BuildDungeonDerivedStateUseCase;
import src.domain.dungeon.application.CreateDungeonMapUseCase;
import src.domain.dungeon.application.DeleteDungeonMapUseCase;
import src.domain.dungeon.application.LoadDungeonSnapshotUseCase;
import src.domain.dungeon.application.LoadMapSnapshotUseCase;
import src.domain.dungeon.application.MapDungeonFactsUseCase;
import src.domain.dungeon.application.SearchDungeonMapsUseCase;
import src.domain.dungeon.map.entity.DungeonAggregate;
import src.domain.dungeon.map.port.DungeonDocumentRepository;
import src.domain.dungeon.map.port.DungeonMapRepository;

import java.util.List;
import java.util.Objects;

/**
 * Public dungeon feature facade used by editor and travel interactors.
 */
public final class DungeonApplicationService {

    private final DungeonDocumentRepository documentRepository;
    private final LoadDungeonSnapshotUseCase loadDungeonSnapshotUseCase;
    private final ApplyDungeonEditorOperationUseCase applyDungeonEditorOperationUseCase;
    private final SearchDungeonMapsUseCase searchDungeonMapsUseCase;
    private final CreateDungeonMapUseCase createDungeonMapUseCase;
    private final DeleteDungeonMapUseCase deleteDungeonMapUseCase;
    private final LoadMapSnapshotUseCase loadMapSnapshotUseCase;
    private final MapDungeonFactsUseCase mapper = new MapDungeonFactsUseCase();

    public DungeonApplicationService(
            DungeonMapRepository mapRepository,
            DungeonDocumentRepository documentRepository
    ) {
        DungeonMapRepository repository = Objects.requireNonNull(mapRepository, "mapRepository");
        this.documentRepository = Objects.requireNonNull(documentRepository, "documentRepository");
        BuildDungeonDerivedStateUseCase derive = new BuildDungeonDerivedStateUseCase();
        this.loadDungeonSnapshotUseCase = new LoadDungeonSnapshotUseCase(this.documentRepository, derive);
        this.applyDungeonEditorOperationUseCase = new ApplyDungeonEditorOperationUseCase(this.documentRepository, derive);
        this.searchDungeonMapsUseCase = new SearchDungeonMapsUseCase(repository, this.documentRepository);
        this.createDungeonMapUseCase = new CreateDungeonMapUseCase(repository, this.documentRepository);
        this.deleteDungeonMapUseCase = new DeleteDungeonMapUseCase(repository, this.documentRepository);
        this.loadMapSnapshotUseCase = new LoadMapSnapshotUseCase(repository, this.documentRepository, derive);
    }

    public DungeonSnapshot loadSnapshot() {
        return toPublishedSnapshot(loadDungeonSnapshotUseCase.execute());
    }

    public DungeonOperationResult applyOperation(DungeonEditorOperation operation) {
        ApplyDungeonEditorOperationUseCase.OperationResultData result =
                applyDungeonEditorOperationUseCase.execute(operation);
        return new DungeonOperationResult(
                toPublishedSnapshot(result.snapshot()),
                result.validationMessages(),
                result.reactionMessages());
    }

    public DungeonInspectorSnapshot describeSelection(String ownerKind, long ownerId) {
        LoadDungeonSnapshotUseCase.InspectorSnapshotData snapshot =
                loadDungeonSnapshotUseCase.describeSelection(ownerKind, ownerId);
        return new DungeonInspectorSnapshot(snapshot.title(), snapshot.description(), snapshot.facts());
    }

    public List<DungeonMapSummary> searchMaps(SearchMapsQuery query) {
        String searchTerm = query == null ? "" : query.query();
        return searchDungeonMapsUseCase.execute(searchTerm).stream()
                .map(summary -> new DungeonMapSummary(
                        mapper.toPublishedId(summary.mapId()),
                        summary.mapName(),
                        summary.revision()))
                .toList();
    }

    public CreateDungeonMapResult createMap(CreateDungeonMapCommand command) {
        String mapName = command == null ? "" : command.mapName();
        CreateDungeonMapUseCase.CreatedMap result = createDungeonMapUseCase.execute(mapName);
        return new CreateDungeonMapResult(mapper.toPublishedId(result.mapId()));
    }

    public DeleteDungeonMapResult deleteMap(DeleteDungeonMapCommand command) {
        DungeonMapId mapId = command == null ? new DungeonMapId(1L) : command.mapId();
        return new DeleteDungeonMapResult(mapper.toPublishedId(
                deleteDungeonMapUseCase.execute(mapper.toDomainIdentity(mapId))));
    }

    public BaseMapSnapshot loadMapSnapshot(LoadMapSnapshotQuery query) {
        LoadMapSnapshotQuery effectiveQuery = query == null
                ? new LoadMapSnapshotQuery(new DungeonMapId(1L), 0)
                : query;
        LoadMapSnapshotUseCase.MapSnapshotData snapshot = loadMapSnapshotUseCase.execute(
                mapper.toDomainIdentity(effectiveQuery.mapId()),
                effectiveQuery.targetFloor());
        return new BaseMapSnapshot(
                mapper.toPublishedId(snapshot.mapId()),
                snapshot.mapName(),
                snapshot.revision(),
                snapshot.targetFloor(),
                mapper.toPublishedSnapshot(snapshot.map()),
                snapshot.empty());
    }

    public void activateMap(DungeonMapId mapId, String mapName) {
        documentRepository.activateMap(mapper.toDomainIdentity(mapId), mapName);
    }

    private DungeonSnapshot toPublishedSnapshot(LoadDungeonSnapshotUseCase.DungeonSnapshotData snapshot) {
        return new DungeonSnapshot(
                snapshot.mapName(),
                DungeonMapMode.EDITOR,
                mapper.toPublishedSnapshot(snapshot.derived().map()),
                snapshot.derived().aggregates().stream().map(DungeonApplicationService::aggregateSummary).toList(),
                snapshot.derived().relations().connections().stream()
                        .map(connection -> "corridor " + connection.corridorId() + " -> room " + connection.roomId()
                                + " (" + connection.direction() + ")")
                        .toList(),
                toPublishedRevision(snapshot.revision()));
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
