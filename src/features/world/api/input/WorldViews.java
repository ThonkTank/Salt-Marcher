package features.world.api.input;

public record WorldViews(
        ui.shell.AppView overworldView,
        ui.shell.AppView mapEditorView,
        ui.shell.AppView dungeonView,
        ui.shell.AppView dungeonEditorView
) {
}
