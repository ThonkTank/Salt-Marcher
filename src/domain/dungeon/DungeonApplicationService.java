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
import src.domain.dungeon.application.DungeonMutationOperations;
import src.domain.dungeon.application.DungeonQueryOperations;
import src.domain.dungeon.application.DungeonDefaultApplicationServices;
import src.domain.dungeon.repository.DungeonDocumentStore;

import java.util.List;
import java.util.Objects;

/**
 * Public dungeon feature facade used by editor and travel interactors.
 */
public final class DungeonApplicationService {

    private final DungeonQueryOperations queries;
    private final DungeonMutationOperations mutations;
    private final DungeonDocumentStore documentStore;

    public DungeonApplicationService() {
        this(DungeonDefaultApplicationServices.instance());
    }

    DungeonApplicationService(
            DungeonQueryOperations queries,
            DungeonMutationOperations mutations,
            DungeonDocumentStore documentStore
    ) {
        this.queries = Objects.requireNonNull(queries, "queries");
        this.mutations = Objects.requireNonNull(mutations, "mutations");
        this.documentStore = Objects.requireNonNull(documentStore, "documentStore");
    }

    private DungeonApplicationService(DungeonDefaultApplicationServices defaults) {
        this(
                defaults.queries(),
                defaults.mutations(),
                defaults.documentStore()
        );
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
        documentStore.activateMap(mapId, mapName);
    }
}
