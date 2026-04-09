package features.world.dungeonclean.input;

import javafx.scene.Node;

@SuppressWarnings("unused")
public record LoadSurfaceInput(
        java.util.function.Consumer<InspectorInfoInput> showInspectorInfo,
        java.util.function.Consumer<HostedInspectorInput> showInspectorContent,
        Runnable clearInspector,
        java.util.function.Predicate<Object> isInspectorShowing,
        java.util.function.Function<SceneRegistrationInput, SceneHandleInput> registerScene,
        java.util.function.Consumer<BackgroundTaskInput> submitBackgroundTask
) {

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

    public record BackgroundTaskInput(
            String operationName,
            java.util.concurrent.Callable<Void> work,
            Runnable onSuccess,
            java.util.function.Consumer<Throwable> onFailure,
            Runnable onCancelled
    ) {
    }

    public record SurfaceInput(
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
