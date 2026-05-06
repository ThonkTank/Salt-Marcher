package src.domain.dungeon.application;

import src.domain.dungeon.map.port.DungeonMapRepository;
import src.domain.dungeon.map.port.DungeonMapSearch;
import src.domain.dungeon.published.DungeonAuthoredMutationCommand;
import src.domain.dungeon.published.DungeonAuthoredMutationResult;
import src.domain.dungeon.published.DungeonAuthoredReadQuery;
import src.domain.dungeon.published.DungeonAuthoredReadResult;
import src.domain.dungeon.published.DungeonMapCatalogCommand;
import src.domain.dungeon.published.DungeonMapCatalogResponse;
import src.domain.dungeon.published.DungeonTravelCommand;
import src.domain.dungeon.published.DungeonTravelResponse;

public final class DungeonBoundaryRuntimeAccess {

    private final DungeonAuthoredRuntimeAdapter authoredRuntimeAdapter;
    private final DungeonCatalogRuntimeAdapter catalogRuntimeAdapter;
    private final DungeonTravelRuntimeAdapter travelRuntimeAdapter;

    private DungeonBoundaryRuntimeAccess(
            DungeonAuthoredRuntimeAdapter authoredRuntimeAdapter,
            DungeonCatalogRuntimeAdapter catalogRuntimeAdapter,
            DungeonTravelRuntimeAdapter travelRuntimeAdapter
    ) {
        this.authoredRuntimeAdapter = authoredRuntimeAdapter;
        this.catalogRuntimeAdapter = catalogRuntimeAdapter;
        this.travelRuntimeAdapter = travelRuntimeAdapter;
    }

    public static DungeonBoundaryRuntimeAccess create(
            DungeonMapRepository repository,
            DungeonMapSearch search
    ) {
        return new DungeonBoundaryRuntimeAccess(
                DungeonAuthoredRuntimeAccess.create(repository, search),
                DungeonCatalogRuntimeAccess.create(repository, search),
                DungeonTravelRuntimeAccess.create(repository, search));
    }

    public DungeonAuthoredReadResult loadAuthored(DungeonAuthoredReadQuery query) {
        return authoredRuntimeAdapter.load(query);
    }

    public DungeonAuthoredMutationResult mutateAuthored(DungeonAuthoredMutationCommand command) {
        return authoredRuntimeAdapter.mutate(command);
    }

    public DungeonMapCatalogResponse catalog(DungeonMapCatalogCommand command) {
        return catalogRuntimeAdapter.handle(command);
    }

    public DungeonTravelResponse travel(DungeonTravelCommand command) {
        return travelRuntimeAdapter.handle(command);
    }
}
