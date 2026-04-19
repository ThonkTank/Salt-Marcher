package src.domain.dungeon.application;

import src.domain.dungeon.map.DungeonMapRepository;

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

    public static DungeonDefaultApplicationServices instance() {
        return INSTANCE;
    }

    public DungeonDocumentStore documentStore() {
        return documentStore;
    }

    public DungeonQueryOperations queries() {
        return queries;
    }

    public DungeonMutationOperations mutations() {
        return mutations;
    }
}
