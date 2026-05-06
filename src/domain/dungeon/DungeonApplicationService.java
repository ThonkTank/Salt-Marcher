package src.domain.dungeon;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.application.DungeonBoundaryRuntimeAccess;
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

/**
 * Public dungeon feature facade used by editor and travel interactors.
 */
public final class DungeonApplicationService {

    private final DungeonBoundaryRuntimeAccess runtime;

    public DungeonApplicationService(
            DungeonMapRepository mapRepository,
            DungeonMapSearch mapSearch
    ) {
        DungeonMapRepository repository = Objects.requireNonNull(mapRepository, "mapRepository");
        DungeonMapSearch search = Objects.requireNonNull(mapSearch, "mapSearch");
        this.runtime = DungeonBoundaryRuntimeAccess.create(repository, search);
    }

    public DungeonAuthoredReadResult loadAuthored(@Nullable DungeonAuthoredReadQuery query) {
        return runtime.loadAuthored(query);
    }

    public DungeonAuthoredMutationResult mutateAuthored(@Nullable DungeonAuthoredMutationCommand command) {
        return runtime.mutateAuthored(command);
    }

    public DungeonMapCatalogResponse catalog(@Nullable DungeonMapCatalogCommand command) {
        return runtime.catalog(command);
    }

    public DungeonTravelResponse travel(@Nullable DungeonTravelCommand command) {
        return runtime.travel(command);
    }
}
