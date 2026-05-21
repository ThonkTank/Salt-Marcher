package src.domain.dungeon;

import java.util.Objects;
import src.domain.dungeon.model.map.usecase.RouteDungeonMapCatalogCommandUseCase;
import src.domain.dungeon.published.DungeonMapCatalogCommand;

/**
 * Public authored-dungeon backend boundary for map catalog work.
 */
public final class DungeonCatalogApplicationService {

    private final RouteDungeonMapCatalogCommandUseCase routeDungeonMapCatalogCommandUseCase;

    public DungeonCatalogApplicationService(RouteDungeonMapCatalogCommandUseCase routeDungeonMapCatalogCommandUseCase) {
        this.routeDungeonMapCatalogCommandUseCase =
                Objects.requireNonNull(routeDungeonMapCatalogCommandUseCase, "routeDungeonMapCatalogCommandUseCase");
    }

    public void catalog(DungeonMapCatalogCommand command) {
        Objects.requireNonNull(command, "command");
        routeDungeonMapCatalogCommandUseCase.execute(
                command.actionKey(),
                command.query(),
                command.mapIdValue(),
                command.mapName());
    }
}
