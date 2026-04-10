package features.tables.input;

import ui.shell.AppView;

@SuppressWarnings("unused")
public record CreateWorkspaceViewInput() {

    public record CreatedWorkspaceViewInput(AppView workspaceView) {
    }
}
