package src.features.dungeon.shell;

import java.util.Objects;
import java.util.concurrent.atomic.AtomicBoolean;
import javafx.application.Platform;
import shell.api.ShellRuntimeContext;
import src.features.dungeon.runtime.DungeonEditorFeatureRuntimeRoot;
import src.features.dungeon.runtime.DungeonEditorRenderFrame;
import src.features.dungeon.runtime.DungeonEditorRuntimeOperations;

public final class DungeonEditorFeatureShellBinding {
    private final DungeonEditorFeatureRuntimeRoot runtimeRoot;

    public DungeonEditorFeatureShellBinding(ShellRuntimeContext runtimeContext) {
        ShellRuntimeContext safeRuntimeContext = Objects.requireNonNull(runtimeContext, "runtimeContext");
        runtimeRoot = DungeonEditorFeatureRuntimeRoot.create(safeRuntimeContext.services());
    }

    public DungeonEditorRuntimeOperations operations() {
        return runtimeRoot.operations();
    }

    public Runnable subscribe(PublicationSink sink) {
        PublicationSink safeSink = Objects.requireNonNull(sink, "sink");
        JavaFxPublicationDelivery delivery = new JavaFxPublicationDelivery(safeSink);
        Runnable unsubscribeRuntime = runtimeRoot.subscribe(publication -> delivery.deliver(publication.frame()));
        return () -> {
            delivery.close();
            unsubscribeRuntime.run();
        };
    }

    public void publishCurrent(PublicationSink sink) {
        JavaFxPublicationDelivery delivery =
                new JavaFxPublicationDelivery(Objects.requireNonNull(sink, "sink"));
        delivery.deliver(runtimeRoot.currentPublication().frame());
    }

    private static final class JavaFxPublicationDelivery {
        private final PublicationSink sink;
        private final AtomicBoolean open = new AtomicBoolean(true);

        private JavaFxPublicationDelivery(PublicationSink sink) {
            this.sink = sink;
        }

        private void deliver(DungeonEditorRenderFrame frame) {
            if (Platform.isFxApplicationThread()) {
                applyIfOpen(frame);
                return;
            }
            Platform.runLater(() -> applyIfOpen(frame));
        }

        private void applyIfOpen(DungeonEditorRenderFrame frame) {
            if (open.get()) {
                sink.apply(frame);
            }
        }

        private void close() {
            open.set(false);
        }
    }

    @FunctionalInterface
    public interface PublicationSink {
        void apply(DungeonEditorRenderFrame frame);
    }
}
