package src.domain.dungeon;

import java.util.Objects;
import src.domain.dungeon.model.runtime.usecase.SetDungeonEditorOverlayUseCase;
import src.domain.dungeon.model.runtime.usecase.SetDungeonEditorToolUseCase;
import src.domain.dungeon.model.runtime.usecase.SetDungeonEditorViewModeUseCase;
import src.domain.dungeon.model.runtime.usecase.ShiftDungeonEditorProjectionLevelUseCase;
import src.domain.dungeon.published.SetDungeonEditorOverlayCommand;
import src.domain.dungeon.published.SetDungeonEditorToolCommand;
import src.domain.dungeon.published.SetDungeonEditorViewModeCommand;
import src.domain.dungeon.published.ShiftDungeonEditorProjectionLevelCommand;

public final class DungeonEditorProjectionApplicationService {

    private static final String COMMAND_REQUIRED_MESSAGE = "command";

    private final SetDungeonEditorViewModeUseCase setViewModeUseCase;
    private final SetDungeonEditorToolUseCase setToolUseCase;
    private final ShiftDungeonEditorProjectionLevelUseCase shiftProjectionLevelUseCase;
    private final SetDungeonEditorOverlayUseCase setOverlayUseCase;

    DungeonEditorProjectionApplicationService(
            SetDungeonEditorViewModeUseCase setViewModeUseCase,
            SetDungeonEditorToolUseCase setToolUseCase,
            ShiftDungeonEditorProjectionLevelUseCase shiftProjectionLevelUseCase,
            SetDungeonEditorOverlayUseCase setOverlayUseCase
    ) {
        this.setViewModeUseCase = Objects.requireNonNull(setViewModeUseCase, "setViewModeUseCase");
        this.setToolUseCase = Objects.requireNonNull(setToolUseCase, "setToolUseCase");
        this.shiftProjectionLevelUseCase = Objects.requireNonNull(
                shiftProjectionLevelUseCase,
                "shiftProjectionLevelUseCase");
        this.setOverlayUseCase = Objects.requireNonNull(setOverlayUseCase, "setOverlayUseCase");
    }

    public void setViewMode(SetDungeonEditorViewModeCommand command) {
        Objects.requireNonNull(command, COMMAND_REQUIRED_MESSAGE);
        setViewModeUseCase.execute(command.viewMode().name());
    }

    public void setTool(SetDungeonEditorToolCommand command) {
        Objects.requireNonNull(command, COMMAND_REQUIRED_MESSAGE);
        setToolUseCase.execute(command.tool().name());
    }

    public void shiftProjectionLevel(ShiftDungeonEditorProjectionLevelCommand command) {
        Objects.requireNonNull(command, COMMAND_REQUIRED_MESSAGE);
        shiftProjectionLevelUseCase.execute(command.projectionLevelDelta());
    }

    public void setOverlay(SetDungeonEditorOverlayCommand command) {
        Objects.requireNonNull(command, COMMAND_REQUIRED_MESSAGE);
        setOverlayUseCase.execute(
                command.overlaySettings().modeKey(),
                command.overlaySettings().levelRange(),
                command.overlaySettings().opacity(),
                command.overlaySettings().selectedLevels());
    }
}
