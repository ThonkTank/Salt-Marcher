package src.domain.dungeon;

import src.domain.dungeon.api.BaseMapSnapshot;
import src.domain.dungeon.api.CreateDungeonMapCommand;
import src.domain.dungeon.api.CreateDungeonMapResult;
import src.domain.dungeon.api.DeleteDungeonMapCommand;
import src.domain.dungeon.api.DeleteDungeonMapResult;
import src.domain.dungeon.api.DungeonEditorOperation;
import src.domain.dungeon.api.DungeonInspectorSnapshot;
import src.domain.dungeon.api.DungeonMapId;
import src.domain.dungeon.api.DungeonMapSummary;
import src.domain.dungeon.api.DungeonOperationResult;
import src.domain.dungeon.api.DungeonSnapshot;
import src.domain.dungeon.api.LoadMapSnapshotQuery;
import src.domain.dungeon.api.SearchMapsQuery;
import src.domain.dungeon.repository.DungeonMapRepository;
import src.domain.dungeon.usecase.DungeonDocumentStore;
import src.domain.dungeon.usecase.DungeonMutationOperations;
import src.domain.dungeon.usecase.DungeonMapStore;
import src.domain.dungeon.usecase.DungeonQueryOperations;

import java.util.List;

/**
 * Public dungeon feature facade used by editor and travel interactors.
 */
public final class dungeonAPI {

    private static final DungeonMapRepository MAP_REPOSITORY = new DungeonMapStore();
    private static final DungeonDocumentStore DOCUMENT_STORE = DungeonDocumentStore.shared();

    private final DungeonQueryOperations queries;
    private final DungeonMutationOperations mutations;

    public dungeonAPI() {
        this.queries = new DungeonQueryOperations(DOCUMENT_STORE, MAP_REPOSITORY);
        this.mutations = new DungeonMutationOperations(DOCUMENT_STORE, MAP_REPOSITORY);
    }

    public DungeonSnapshot loadSnapshot() {
        return queries.loadSnapshot();
    }

    public DungeonOperationResult applyOperation(DungeonEditorOperation operation) {
        return mutations.applyOperation(operation);
    }

    public DungeonInspectorSnapshot describeSelection(String ownerKind, long ownerId) {
        return queries.describeSelection(ownerKind, ownerId);
    }

    public List<DungeonMapSummary> searchMaps(SearchMapsQuery query) {
        return queries.searchMaps(query);
    }

    public CreateDungeonMapResult createMap(CreateDungeonMapCommand command) {
        return mutations.createMap(command);
    }

    public DeleteDungeonMapResult deleteMap(DeleteDungeonMapCommand command) {
        return mutations.deleteMap(command);
    }

    public BaseMapSnapshot loadMapSnapshot(LoadMapSnapshotQuery query) {
        return queries.loadMapSnapshot(query);
    }

    public void activateMap(DungeonMapId mapId, String mapName) {
        DOCUMENT_STORE.activateMap(mapId, mapName);
    }
}
