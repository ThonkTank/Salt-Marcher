package src.domain.dungeon;

import java.util.Objects;
import src.domain.dungeon.model.worldspace.usecase.PublishDungeonTravelMoveUseCase;
import src.domain.dungeon.model.worldspace.usecase.PublishDungeonTravelSurfaceUseCase;
import src.domain.dungeon.published.DungeonTravelCommand;

/**
 * Public authored-dungeon backend boundary for raw travel surface work.
 */
public final class DungeonTravelApplicationService {

    private final PublishDungeonTravelSurfaceUseCase publishSurfaceUseCase;
    private final PublishDungeonTravelMoveUseCase publishMoveUseCase;

    public DungeonTravelApplicationService(
            PublishDungeonTravelSurfaceUseCase publishSurfaceUseCase,
            PublishDungeonTravelMoveUseCase publishMoveUseCase
    ) {
        this.publishSurfaceUseCase = Objects.requireNonNull(publishSurfaceUseCase, "publishSurfaceUseCase");
        this.publishMoveUseCase = Objects.requireNonNull(publishMoveUseCase, "publishMoveUseCase");
    }

    public void loadSurface(DungeonTravelCommand.LoadSurfaceCommand command) {
        Objects.requireNonNull(command, "command");
        publishSurfaceUseCase.execute(command.position() == null
                ? null
                : new PublishDungeonTravelSurfaceUseCase.PositionInput(
                        command.position().mapId().value(),
                        command.position().locationKind().name(),
                        command.position().ownerId(),
                        command.position().tile().q(),
                        command.position().tile().r(),
                        command.position().tile().level(),
                        command.position().heading().name()));
    }

    public void moveAction(DungeonTravelCommand.MoveActionCommand command) {
        Objects.requireNonNull(command, "command");
        publishMoveUseCase.execute(new PublishDungeonTravelMoveUseCase.MoveInput(
                command.position() == null
                        ? null
                        : new PublishDungeonTravelMoveUseCase.PositionInput(
                                command.position().mapId().value(),
                                command.position().locationKind().name(),
                                command.position().ownerId(),
                                command.position().tile().q(),
                                command.position().tile().r(),
                                command.position().tile().level(),
                                command.position().heading().name()),
                command.actionId()));
    }
}
