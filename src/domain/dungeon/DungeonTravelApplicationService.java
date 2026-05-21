package src.domain.dungeon;

import java.util.Objects;
import src.domain.dungeon.model.travel.usecase.ApplyDungeonTravelUseCase;
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
                : new ApplyDungeonTravelUseCase.PositionInput(
                        new ApplyDungeonTravelUseCase.MapInput(command.position().mapId().value()),
                        switch (command.position().locationKind().name()) {
                            case "STAIR_EXIT" -> ApplyDungeonTravelUseCase.LocationKindInput.STAIR_EXIT;
                            case "TRANSITION" -> ApplyDungeonTravelUseCase.LocationKindInput.TRANSITION;
                            default -> ApplyDungeonTravelUseCase.LocationKindInput.TILE;
                        },
                        command.position().ownerId(),
                        new ApplyDungeonTravelUseCase.CellInput(
                                command.position().tile().q(),
                                command.position().tile().r(),
                                command.position().tile().level()),
                        switch (command.position().heading().name()) {
                            case "NORTH" -> ApplyDungeonTravelUseCase.HeadingInput.NORTH;
                            case "EAST" -> ApplyDungeonTravelUseCase.HeadingInput.EAST;
                            case "WEST" -> ApplyDungeonTravelUseCase.HeadingInput.WEST;
                            default -> ApplyDungeonTravelUseCase.HeadingInput.SOUTH;
                        }));
    }

    public void moveAction(DungeonTravelCommand.MoveActionCommand command) {
        Objects.requireNonNull(command, "command");
        publishMoveUseCase.execute(new PublishDungeonTravelMoveUseCase.MoveInput(
                command.position() == null
                        ? null
                        : new ApplyDungeonTravelUseCase.PositionInput(
                                new ApplyDungeonTravelUseCase.MapInput(command.position().mapId().value()),
                                switch (command.position().locationKind().name()) {
                                    case "STAIR_EXIT" -> ApplyDungeonTravelUseCase.LocationKindInput.STAIR_EXIT;
                                    case "TRANSITION" -> ApplyDungeonTravelUseCase.LocationKindInput.TRANSITION;
                                    default -> ApplyDungeonTravelUseCase.LocationKindInput.TILE;
                                },
                                command.position().ownerId(),
                                new ApplyDungeonTravelUseCase.CellInput(
                                        command.position().tile().q(),
                                        command.position().tile().r(),
                                        command.position().tile().level()),
                                switch (command.position().heading().name()) {
                                    case "NORTH" -> ApplyDungeonTravelUseCase.HeadingInput.NORTH;
                                    case "EAST" -> ApplyDungeonTravelUseCase.HeadingInput.EAST;
                                    case "WEST" -> ApplyDungeonTravelUseCase.HeadingInput.WEST;
                                    default -> ApplyDungeonTravelUseCase.HeadingInput.SOUTH;
                                }),
                command.actionId()));
    }
}
