package src.domain.dungeon.application;

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
import src.domain.dungeon.map.DungeonMapRepository;

import java.util.List;
import java.util.Objects;

public final class DungeonDefaultApplicationServices {

    private static final DungeonDefaultApplicationServices INSTANCE = new DungeonDefaultApplicationServices(
            new DungeonMapStore(),
            new DungeonDocumentStore()
    );

    private final DungeonDocumentStore documentStore;
    private final DungeonQueryOperations queries;
    private final DungeonMutationOperations mutations;

    private DungeonDefaultApplicationServices(
            DungeonMapRepository mapRepository,
            DungeonDocumentStore documentStore
    ) {
        DungeonMapRepository repository = Objects.requireNonNull(mapRepository, "mapRepository");
        this.documentStore = Objects.requireNonNull(documentStore, "documentStore");
        this.queries = new DungeonQueryOperations(this.documentStore, repository);
        this.mutations = new DungeonMutationOperations(this.documentStore, repository);
    }

    public static DungeonSnapshot loadSnapshot() {
        return INSTANCE.queries.loadSnapshot();
    }

    public static DungeonOperationResult applyOperation(DungeonEditorOperation operation) {
        return INSTANCE.mutations.applyOperation(operation);
    }

    public static DungeonInspectorSnapshot describeSelection(String ownerKind, long ownerId) {
        return INSTANCE.queries.describeSelection(ownerKind, ownerId);
    }

    public static List<DungeonMapSummary> searchMaps(SearchMapsQuery query) {
        return INSTANCE.queries.searchMaps(query);
    }

    public static CreateDungeonMapResult createMap(CreateDungeonMapCommand command) {
        return INSTANCE.mutations.createMap(command);
    }

    public static DeleteDungeonMapResult deleteMap(DeleteDungeonMapCommand command) {
        return INSTANCE.mutations.deleteMap(command);
    }

    public static BaseMapSnapshot loadMapSnapshot(LoadMapSnapshotQuery query) {
        return INSTANCE.queries.loadMapSnapshot(query);
    }

    public static void activateMap(DungeonMapId mapId, String mapName) {
        INSTANCE.documentStore.activateMap(mapId, mapName);
    }
}
