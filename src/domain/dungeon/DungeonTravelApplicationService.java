package src.domain.dungeon;

import java.util.Objects;
import src.domain.dungeon.model.travel.usecase.RouteDungeonTravelCommandUseCase;
import src.domain.dungeon.published.DungeonTravelCommand;

/**
 * Public authored-dungeon backend boundary for raw travel surface work.
 */
public final class DungeonTravelApplicationService {

    private final RouteDungeonTravelCommandUseCase routeDungeonTravelCommandUseCase;

    public DungeonTravelApplicationService(RouteDungeonTravelCommandUseCase routeDungeonTravelCommandUseCase) {
        this.routeDungeonTravelCommandUseCase =
                Objects.requireNonNull(routeDungeonTravelCommandUseCase, "routeDungeonTravelCommandUseCase");
    }

    public void travel(DungeonTravelCommand command) {
        Objects.requireNonNull(command, "command");
        routeDungeonTravelCommandUseCase.execute(
                command.operationKey(),
                command.hasPosition(),
                command.mapIdValue(),
                command.locationKindName(),
                command.ownerId(),
                command.tileQ(),
                command.tileR(),
                command.tileLevel(),
                command.headingName(),
                command.actionId());
    }
}
