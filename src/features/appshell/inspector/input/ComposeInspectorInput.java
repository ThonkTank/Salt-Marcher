package features.appshell.inspector.input;

import javafx.scene.Node;

@SuppressWarnings("unused")
public record ComposeInspectorInput() {

    public record InfoEntryInput(
            String title,
            Object entryKey,
            String message
    ) {
    }

    public record HostedEntryInput(
            String title,
            Object entryKey,
            java.util.function.Supplier<Node> contentSupplier
    ) {
    }

    public record NavigatorInput(
            java.util.function.Consumer<InfoEntryInput> showInfo,
            java.util.function.Consumer<HostedEntryInput> showContent,
            Runnable clear,
            java.util.function.Predicate<Object> isShowing
    ) {
    }

    public record InspectorInput(
            Node detailsContent,
            NavigatorInput navigator
    ) {
    }
}
