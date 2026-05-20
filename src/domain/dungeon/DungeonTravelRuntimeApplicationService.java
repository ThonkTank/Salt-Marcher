package src.domain.dungeon;

import java.util.Objects;
import src.domain.dungeon.model.travel.usecase.ApplyTravelDungeonSessionUseCase;
import src.domain.dungeon.published.ApplyTravelDungeonSessionCommand;

/**
 * Public backend facade for runtime travel composition.
 */
public final class DungeonTravelRuntimeApplicationService {

    private final ApplyTravelDungeonSessionUseCase applyTravelDungeonSessionUseCase;

    public DungeonTravelRuntimeApplicationService(ApplyTravelDungeonSessionUseCase applyTravelDungeonSessionUseCase) {
        this.applyTravelDungeonSessionUseCase =
                Objects.requireNonNull(applyTravelDungeonSessionUseCase, "applyTravelDungeonSessionUseCase");
    }

    public void applyDungeonTravelSession(ApplyTravelDungeonSessionCommand command) {
        Objects.requireNonNull(command, "command");
        applyTravelDungeonSessionUseCase.applyCommand(
                command.actionToken(),
                command.actionId(),
                command.projectionLevel(),
                command.overlaySettings().modeKey(),
                command.overlaySettings().levelRange(),
                command.overlaySettings().opacity(),
                command.overlaySettings().selectedLevels());
    }
}
