package src.domain.dungeon;

import java.util.Objects;
import src.domain.dungeon.model.travel.usecase.PublishDungeonTravelMoveUseCase;
import src.domain.dungeon.model.travel.usecase.PublishDungeonTravelSurfaceUseCase;
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
        publishSurfaceUseCase.execute(new PublishDungeonTravelSurfaceUseCase.PositionInput(
                command.position() != null,
                command.position() == null ? 1L : command.position().mapId().value(),
                command.position() == null ? "TILE" : command.position().locationKind().name(),
                command.position() == null ? 0L : command.position().ownerId(),
                command.position() == null ? 0 : command.position().tile().q(),
                command.position() == null ? 0 : command.position().tile().r(),
                command.position() == null ? 0 : command.position().tile().level(),
                command.position() == null ? "SOUTH" : command.position().heading().name()));
    }

    public void moveAction(DungeonTravelCommand.MoveActionCommand command) {
        Objects.requireNonNull(command, "command");
        publishMoveUseCase.execute(new PublishDungeonTravelMoveUseCase.MoveInput(
                new PublishDungeonTravelMoveUseCase.PositionInput(
                        command.position() != null,
                        command.position() == null ? 1L : command.position().mapId().value(),
                        command.position() == null ? "TILE" : command.position().locationKind().name(),
                        command.position() == null ? 0L : command.position().ownerId(),
                        command.position() == null ? 0 : command.position().tile().q(),
                        command.position() == null ? 0 : command.position().tile().r(),
                        command.position() == null ? 0 : command.position().tile().level(),
                        command.position() == null ? "SOUTH" : command.position().heading().name()),
                command.actionId()));
    }
}
