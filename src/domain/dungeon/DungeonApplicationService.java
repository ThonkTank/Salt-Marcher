package src.domain.dungeon;

import src.domain.dungeon.published.BaseMapSnapshot;
import src.domain.dungeon.published.CreateDungeonMapCommand;
import src.domain.dungeon.published.CreateDungeonMapResult;
import src.domain.dungeon.published.DeleteDungeonMapCommand;
import src.domain.dungeon.published.DeleteDungeonMapResult;
import src.domain.dungeon.published.DungeonEditorOperation;
import src.domain.dungeon.published.DungeonInspectorSnapshot;
import src.domain.dungeon.published.DungeonMapId;
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
        return loadDungeonSnapshotUseCase.execute();
    }

    public DungeonOperationResult applyOperation(DungeonEditorOperation operation) {
        return applyDungeonEditorOperationUseCase.execute(operation);
    }

    public DungeonInspectorSnapshot describeSelection(String ownerKind, long ownerId) {
        return loadDungeonSnapshotUseCase.describeSelection(ownerKind, ownerId);
    }

    public List<DungeonMapSummary> searchMaps(SearchMapsQuery query) {
        return searchDungeonMapsUseCase.execute(query);
    }

    public CreateDungeonMapResult createMap(CreateDungeonMapCommand command) {
        return createDungeonMapUseCase.execute(command);
    }

    public DeleteDungeonMapResult deleteMap(DeleteDungeonMapCommand command) {
        return deleteDungeonMapUseCase.execute(command);
    }

    public BaseMapSnapshot loadMapSnapshot(LoadMapSnapshotQuery query) {
        return loadMapSnapshotUseCase.execute(query);
    }

    public void activateMap(DungeonMapId mapId, String mapName) {
        documentRepository.activateMap(mapper.toDomainIdentity(mapId), mapName);
    }
}
