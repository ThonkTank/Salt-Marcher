package features.world.dungeonclean.editor.input;

import javafx.scene.Node;

@SuppressWarnings("unused")
public record ComposeWorkspaceInput(
        java.util.concurrent.Callable<StatusSnapshot> statusLoader,
        java.util.function.Consumer<InspectorInfoInput> showInspectorInfo,
        java.util.function.Consumer<HostedInspectorInput> showInspectorContent,
        Runnable clearInspector,
        java.util.function.Predicate<Object> isInspectorShowing
) {

    public record StatusSnapshot(
            long roomCount,
            long roomLevelCount,
            long roomNarrationCount,
            String errorMessage
    ) {
    }

    public record InspectorInfoInput(
            String title,
            Object entryKey,
            String message
    ) {
    }

    public record HostedInspectorInput(
            String title,
            Object entryKey,
            java.util.function.Supplier<Node> contentSupplier
    ) {
    }

    public record WorkspaceInput(
            String surfaceId,
            String title,
            String navigationLabel,
            Node toolbarContent,
            Node controlsContent,
            Node mainContent,
            Node detailsContent,
            Node stateContent,
            Runnable onShow,
            Runnable onHide
    ) {
    }
}
