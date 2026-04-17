package src.domain.dungeon;

import src.domain.dungeon.api.BaseMapSnapshot;
import src.domain.dungeon.api.CreateDungeonMapCommand;
import src.domain.dungeon.api.CreateDungeonMapResult;
import src.domain.dungeon.api.DeleteDungeonMapCommand;
import src.domain.dungeon.api.DeleteDungeonMapResult;
import src.domain.dungeon.api.DungeonEditorOperation;
import src.domain.dungeon.api.DungeonInspectorSnapshot;
import src.domain.dungeon.api.DungeonMapSummary;
import src.domain.dungeon.api.DungeonOperationResult;
import src.domain.dungeon.api.DungeonSnapshot;
import src.domain.dungeon.api.LoadMapSnapshotQuery;
import src.domain.dungeon.api.SearchMapsQuery;
import src.domain.dungeon.repository.DungeonMapRepository;
import src.domain.dungeon.usecase.ApplyDungeonEditorOperationUseCase;
import src.domain.dungeon.usecase.BuildDungeonDerivedStateUseCase;
import src.domain.dungeon.usecase.CreateDungeonMapUseCase;
import src.domain.dungeon.usecase.DeleteDungeonMapUseCase;
import src.domain.dungeon.usecase.DungeonDocumentStore;
import src.domain.dungeon.usecase.DungeonMapStore;
import src.domain.dungeon.usecase.LoadDungeonSnapshotUseCase;
import src.domain.dungeon.usecase.LoadMapSnapshotUseCase;
import src.domain.dungeon.usecase.SearchDungeonMapsUseCase;

import java.util.List;

/**
 * Public dungeon feature facade used by editor and travel interactors.
 */
public final class dungeonAPI {

    private static final DungeonMapRepository MAP_REPOSITORY = new DungeonMapStore();

    private final LoadDungeonSnapshotUseCase loadSnapshotUseCase;
    private final ApplyDungeonEditorOperationUseCase applyOperationUseCase;
    private final SearchDungeonMapsUseCase searchDungeonMapsUseCase;
    private final CreateDungeonMapUseCase createDungeonMapUseCase;
    private final DeleteDungeonMapUseCase deleteDungeonMapUseCase;
    private final LoadMapSnapshotUseCase loadMapSnapshotUseCase;

    public dungeonAPI() {
        DungeonDocumentStore store = DungeonDocumentStore.demo();
        BuildDungeonDerivedStateUseCase derive = new BuildDungeonDerivedStateUseCase();
        this.loadSnapshotUseCase = new LoadDungeonSnapshotUseCase(store, derive);
        this.applyOperationUseCase = new ApplyDungeonEditorOperationUseCase(store, derive);
        this.searchDungeonMapsUseCase = new SearchDungeonMapsUseCase(MAP_REPOSITORY);
        this.createDungeonMapUseCase = new CreateDungeonMapUseCase(MAP_REPOSITORY);
        this.deleteDungeonMapUseCase = new DeleteDungeonMapUseCase(MAP_REPOSITORY);
        this.loadMapSnapshotUseCase = new LoadMapSnapshotUseCase(MAP_REPOSITORY);
    }

    public DungeonSnapshot loadSnapshot() {
        return loadSnapshotUseCase.execute();
    }

    public DungeonOperationResult applyOperation(DungeonEditorOperation operation) {
        return applyOperationUseCase.execute(operation);
    }

    public DungeonInspectorSnapshot describeSelection(String ownerKind, long ownerId) {
        return loadSnapshotUseCase.describeSelection(ownerKind, ownerId);
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
}
