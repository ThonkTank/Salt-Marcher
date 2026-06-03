package src.domain.dungeon;

import java.util.Objects;
import src.domain.dungeon.model.runtime.usecase.PublishTravelDungeonSessionUseCase;
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
        publishTravelDungeonSessionUseCase.execute(
                command.actionToken(),
                command.actionId(),
                command.projectionLevel(),
                command.overlaySettings().modeKey(),
                command.overlaySettings().levelRange(),
                command.overlaySettings().opacity(),
                command.overlaySettings().selectedLevels());
    }
}
