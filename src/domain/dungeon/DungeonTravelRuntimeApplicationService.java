package src.domain.dungeon;

import java.util.Objects;
import src.domain.dungeon.model.runtime.usecase.PublishTravelDungeonSessionUseCase;
import src.domain.dungeon.model.runtime.usecase.PublishTravelDungeonSessionUseCase.Command;
import src.domain.dungeon.published.ApplyTravelDungeonSessionCommand;

/**
 * Public backend facade for runtime travel composition.
 */
public final class DungeonTravelRuntimeApplicationService {

    private final PublishTravelDungeonSessionUseCase publishTravelDungeonSessionUseCase;

    public DungeonTravelRuntimeApplicationService(
            PublishTravelDungeonSessionUseCase publishTravelDungeonSessionUseCase
    ) {
        this.publishTravelDungeonSessionUseCase =
                Objects.requireNonNull(publishTravelDungeonSessionUseCase, "publishTravelDungeonSessionUseCase");
    }

    public void applyDungeonTravelSession(ApplyTravelDungeonSessionCommand command) {
        Objects.requireNonNull(command, "command");
        publishTravelDungeonSessionUseCase.execute(toUseCaseCommand(command));
    }

    private static Command toUseCaseCommand(
            ApplyTravelDungeonSessionCommand command
    ) {
        return switch (command.action().name()) {
            case "REFRESH" -> Command.refresh();
            case "ACTION" -> Command.travelAction(command.actionId());
            case "SELECT_MAP" -> Command.selectMap(command.actionId());
            case "SET_PROJECTION_LEVEL" -> Command.setProjectionLevel(command.projectionLevel());
            case "SHIFT_PROJECTION_LEVEL" -> Command.shiftProjectionLevel(command.projectionLevel());
            case "SET_OVERLAY" -> Command.setOverlay(
                    command.overlaySettings().modeKey(),
                    command.overlaySettings().levelRange(),
                    command.overlaySettings().opacity(),
                    command.overlaySettings().selectedLevels());
            default -> throw new IllegalStateException("Unhandled travel dungeon session action.");
        };
    }
}
