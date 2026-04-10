package clean.startup.task;

import clean.navigation.input.ComposeNavigationInput;
import clean.startup.input.StartApplicationInput;

public final class StartApplicationTask {

    private StartApplicationTask() {
    }

    public static ComposeNavigationInput startApplication(StartApplicationInput input) {
        return new ComposeNavigationInput(
                input.startSurface(),
                input.encounterSurface(),
                input.overworldSurface(),
                input.mapEditorSurface(),
                input.dungeonSurface(),
                input.dungeonEditorSurface(),
                input.tablesSurface(),
                input.spellsSurface(),
                input.initialSurfaceId());
    }
}
