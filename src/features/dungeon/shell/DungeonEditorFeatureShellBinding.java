package src.features.dungeon.shell;

import java.util.Objects;
import java.util.concurrent.atomic.AtomicBoolean;
import javafx.application.Platform;
import src.features.dungeon.runtime.DungeonEditorFeatureRuntimeRoot;
import src.features.dungeon.runtime.DungeonEditorRenderFrame;
import src.features.dungeon.runtime.DungeonEditorRuntimeDependencies;
import src.features.dungeon.runtime.DungeonEditorRuntimeOperations;

public final class DungeonEditorFeatureShellBinding {
    private final DungeonEditorFeatureRuntimeRoot runtimeRoot;

    public DungeonEditorFeatureShellBinding(DungeonEditorRuntimeDependencies dependencies) {
        runtimeRoot = DungeonEditorFeatureRuntimeRoot.create(
                Objects.requireNonNull(dependencies, "dependencies"));
    }

    public DungeonEditorRuntimeOperations operations() {
        return runtimeRoot.operations();
    }

    public Runnable subscribe(PublicationSink sink) {
        PublicationSink safeSink = Objects.requireNonNull(sink, "sink");
        JavaFxPublicationDelivery delivery = new JavaFxPublicationDelivery(safeSink);
        Runnable unsubscribeRuntime = runtimeRoot.subscribe(delivery::deliver);
        return () -> {
            delivery.close();
            unsubscribeRuntime.run();
        };
    }

    public void publishCurrent(PublicationSink sink) {
        JavaFxPublicationDelivery delivery =
                new JavaFxPublicationDelivery(Objects.requireNonNull(sink, "sink"));
        delivery.deliver(runtimeRoot.currentFrame());
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
