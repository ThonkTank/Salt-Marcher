package src.domain.dungeon;

import java.util.Objects;
import src.domain.dungeon.model.runtime.usecase.PublishTravelDungeonSessionUseCase;
import src.domain.dungeon.model.runtime.usecase.PublishTravelDungeonSessionUseCase.Command;
import src.domain.dungeon.published.ApplyTravelDungeonSessionCommand;
import src.domain.dungeon.published.DungeonOverlaySettings;

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
        publishTravelDungeonSessionUseCase.execute(Command.fromBoundary(
                command.actionCode(),
                command.selectedActionRowIndex(),
                command.mapId(),
                command.projectionLevel(),
                command.overlaySettings().modeKey(),
                command.overlaySettings().levelRange(),
                command.overlaySettings().opacity(),
                command.overlaySettings().selectedLevels()));
    }

    public void refresh() {
        applyDungeonTravelSession(new ApplyTravelDungeonSessionCommand(
                ApplyTravelDungeonSessionCommand.Action.REFRESH,
                -1,
                0L,
                0,
                DungeonOverlaySettings.defaults()));
    }

    public void performAction(int selectedActionRowIndex) {
        applyDungeonTravelSession(ApplyTravelDungeonSessionCommand.action(selectedActionRowIndex));
    }

    public void selectMap(long mapId) {
        applyDungeonTravelSession(ApplyTravelDungeonSessionCommand.selectMap(mapId));
    }

    public void shiftProjectionLevel(int projectionLevelShift) {
        applyDungeonTravelSession(ApplyTravelDungeonSessionCommand.projectionLevelShift(projectionLevelShift));
    }

    public void setOverlay(DungeonOverlaySettings overlaySettings) {
        applyDungeonTravelSession(ApplyTravelDungeonSessionCommand.overlay(overlaySettings));
    }
}
