package features.world.input;

@SuppressWarnings("unused")
public record ViewsInput(
        ui.shell.AppView overworldView,
        ui.shell.AppView mapEditorView,
        ui.shell.AppView dungeonView,
        ui.shell.AppView dungeonEditorView
) {
}
