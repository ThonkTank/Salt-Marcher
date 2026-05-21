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
        publishSurfaceUseCase.execute(command.position() == null
                ? null
                : new PublishDungeonTravelSurfaceUseCase.PositionInput(
                        new PublishDungeonTravelSurfaceUseCase.MapInput(command.position().mapId().value()),
                        switch (command.position().locationKind().name()) {
                            case "STAIR_EXIT" -> PublishDungeonTravelSurfaceUseCase.LocationKindInput.STAIR_EXIT;
                            case "TRANSITION" -> PublishDungeonTravelSurfaceUseCase.LocationKindInput.TRANSITION;
                            default -> PublishDungeonTravelSurfaceUseCase.LocationKindInput.TILE;
                        },
                        command.position().ownerId(),
                        new PublishDungeonTravelSurfaceUseCase.CellInput(
                                command.position().tile().q(),
                                command.position().tile().r(),
                                command.position().tile().level()),
                        switch (command.position().heading().name()) {
                            case "NORTH" -> PublishDungeonTravelSurfaceUseCase.HeadingInput.NORTH;
                            case "EAST" -> PublishDungeonTravelSurfaceUseCase.HeadingInput.EAST;
                            case "WEST" -> PublishDungeonTravelSurfaceUseCase.HeadingInput.WEST;
                            default -> PublishDungeonTravelSurfaceUseCase.HeadingInput.SOUTH;
                        }));
    }

    public void moveAction(DungeonTravelCommand.MoveActionCommand command) {
        Objects.requireNonNull(command, "command");
        publishMoveUseCase.execute(new PublishDungeonTravelMoveUseCase.MoveInput(
                command.position() == null
                        ? null
                        : new PublishDungeonTravelMoveUseCase.PositionInput(
                                new PublishDungeonTravelMoveUseCase.MapInput(command.position().mapId().value()),
                                switch (command.position().locationKind().name()) {
                                    case "STAIR_EXIT" -> PublishDungeonTravelMoveUseCase.LocationKindInput.STAIR_EXIT;
                                    case "TRANSITION" -> PublishDungeonTravelMoveUseCase.LocationKindInput.TRANSITION;
                                    default -> PublishDungeonTravelMoveUseCase.LocationKindInput.TILE;
                                },
                                command.position().ownerId(),
                                new PublishDungeonTravelMoveUseCase.CellInput(
                                        command.position().tile().q(),
                                        command.position().tile().r(),
                                        command.position().tile().level()),
                                switch (command.position().heading().name()) {
                                    case "NORTH" -> PublishDungeonTravelMoveUseCase.HeadingInput.NORTH;
                                    case "EAST" -> PublishDungeonTravelMoveUseCase.HeadingInput.EAST;
                                    case "WEST" -> PublishDungeonTravelMoveUseCase.HeadingInput.WEST;
                                    default -> PublishDungeonTravelMoveUseCase.HeadingInput.SOUTH;
                                }),
                command.actionId()));
    }
}
