package features.world.dungeonclean.editor.input;

import javafx.scene.Node;

@SuppressWarnings("unused")
public record ComposeWorkspaceInput(
        java.util.function.Consumer<LoadStatusAsyncInput> loadStatusAsync,
        java.util.function.Consumer<InspectorInfoInput> showInspectorInfo,
        java.util.function.Consumer<HostedInspectorInput> showInspectorContent,
        Runnable clearInspector,
        java.util.function.Predicate<Object> isInspectorShowing,
        java.util.function.Function<SceneRegistrationInput, SceneHandleInput> registerScene
) {

    public record StatusSnapshot(
            long roomCount,
            long roomLevelCount,
            long roomNarrationCount,
            String errorMessage
    ) {
    }

    public record LoadStatusAsyncInput(
            Runnable onLoading,
            java.util.function.Consumer<StatusSnapshot> onLoaded,
            java.util.function.Consumer<Throwable> onFailure
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

    public record SceneRegistrationInput(
            String label,
            Node initialContent
    ) {
    }

    public record SceneHandleInput(
            java.util.function.Consumer<Node> setContent,
            Runnable activate
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
