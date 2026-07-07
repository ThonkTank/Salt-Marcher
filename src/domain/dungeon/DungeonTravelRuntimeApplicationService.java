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
                toUseCaseAction(command),
                command.actionId(),
                command.projectionLevel(),
                command.overlaySettings().modeKey(),
                command.overlaySettings().levelRange(),
                command.overlaySettings().opacity(),
                command.overlaySettings().selectedLevels());
    }

    private static PublishTravelDungeonSessionUseCase.Action toUseCaseAction(
            ApplyTravelDungeonSessionCommand command
    ) {
        if (command.isRefreshAction()) {
            return PublishTravelDungeonSessionUseCase.Action.REFRESH;
        }
        if (command.isTravelAction()) {
            return PublishTravelDungeonSessionUseCase.Action.ACTION;
        }
        if (command.isSelectMapAction()) {
            return PublishTravelDungeonSessionUseCase.Action.SELECT_MAP;
        }
        if (command.isSetProjectionLevelAction()) {
            return PublishTravelDungeonSessionUseCase.Action.SET_PROJECTION_LEVEL;
        }
        if (command.isShiftProjectionLevelAction()) {
            return PublishTravelDungeonSessionUseCase.Action.SHIFT_PROJECTION_LEVEL;
        }
        if (command.isSetOverlayAction()) {
            return PublishTravelDungeonSessionUseCase.Action.SET_OVERLAY;
        }
        throw new IllegalStateException("Unhandled travel dungeon session command action.");
    }
}
