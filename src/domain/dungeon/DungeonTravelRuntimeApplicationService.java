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
        applyTravelDungeonSessionUseCase.apply(new ApplyTravelDungeonSessionUseCase.SessionCommand(
                switch (command.action()) {
                    case REFRESH -> ApplyTravelDungeonSessionUseCase.SessionAction.REFRESH;
                    case ACTION -> ApplyTravelDungeonSessionUseCase.SessionAction.ACTION;
                    case SET_PROJECTION_LEVEL -> ApplyTravelDungeonSessionUseCase.SessionAction.SET_PROJECTION_LEVEL;
                    case SET_OVERLAY -> ApplyTravelDungeonSessionUseCase.SessionAction.SET_OVERLAY;
                },
                command.actionId(),
                command.projectionLevel(),
                command.overlaySettings().modeKey(),
                command.overlaySettings().levelRange(),
                command.overlaySettings().opacity(),
                command.overlaySettings().selectedLevels()));
    }
}
