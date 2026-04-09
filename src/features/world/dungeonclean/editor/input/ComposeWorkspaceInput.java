package features.world.dungeonclean.editor.input;

import javafx.scene.Node;

@SuppressWarnings("unused")
public record ComposeWorkspaceInput(
        java.util.concurrent.Callable<StatusSnapshot> statusLoader
) {

    public record StatusSnapshot(
            long roomCount,
            long roomLevelCount,
            long roomNarrationCount,
            String errorMessage
    ) {
    }

    public record WorkspaceInput(
            String title,
            String navigationLabel,
            Node controlsContent,
            Node mainContent,
            Node detailsContent,
            Node stateContent
    ) {
    }
}
