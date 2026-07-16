package features.dungeon.adapter.javafx.editor;

import java.util.Objects;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;
import platform.ui.UiDispatcher;
import features.dungeon.application.editor.DungeonEditorFeatureRuntimeRoot;
import features.dungeon.application.editor.DungeonEditorRenderFrame;
import features.dungeon.application.editor.DungeonEditorRuntimeDependencies;
import features.dungeon.application.editor.DungeonEditorRuntimeOperations;

public final class DungeonEditorFeatureShellBinding {
    private final DungeonEditorFeatureRuntimeRoot runtimeRoot;
    private final UiDispatcher uiDispatcher;

    public DungeonEditorFeatureShellBinding(DungeonEditorRuntimeDependencies dependencies) {
        DungeonEditorRuntimeDependencies safeDependencies =
                Objects.requireNonNull(dependencies, "dependencies");
        runtimeRoot = DungeonEditorFeatureRuntimeRoot.create(safeDependencies);
        uiDispatcher = safeDependencies.uiDispatcher();
    }

    public DungeonEditorRuntimeOperations operations() {
        return runtimeRoot.operations();
    }

    public Runnable subscribe(PublicationSink sink) {
        PublicationSink safeSink = Objects.requireNonNull(sink, "sink");
        PublicationDelivery delivery = new PublicationDelivery(safeSink, uiDispatcher);
        Runnable unsubscribeRuntime = runtimeRoot.subscribe(delivery::deliver);
        return () -> {
            delivery.close();
            unsubscribeRuntime.run();
        };
    }

    public void publishCurrent(PublicationSink sink) {
        PublicationDelivery delivery =
                new PublicationDelivery(Objects.requireNonNull(sink, "sink"), uiDispatcher);
        delivery.deliver(runtimeRoot.currentFrame());
    }

    static final class PublicationDelivery {
        private final PublicationSink sink;
        private final UiDispatcher uiDispatcher;
        private final AtomicBoolean open = new AtomicBoolean(true);
        private final AtomicLong deliveryRevision = new AtomicLong();

        PublicationDelivery(PublicationSink sink, UiDispatcher uiDispatcher) {
            this.sink = Objects.requireNonNull(sink, "sink");
            this.uiDispatcher = Objects.requireNonNull(uiDispatcher, "uiDispatcher");
        }

        void deliver(DungeonEditorRenderFrame frame) {
            long revision = deliveryRevision.incrementAndGet();
            uiDispatcher.dispatch(() -> applyIfCurrent(revision, frame));
        }

        private void applyIfCurrent(long revision, DungeonEditorRenderFrame frame) {
            if (open.get() && revision == deliveryRevision.get()) {
                sink.apply(frame);
            }
        }

        void close() {
            open.set(false);
            deliveryRevision.incrementAndGet();
        }
    }

    @FunctionalInterface
    public interface PublicationSink {
        void apply(DungeonEditorRenderFrame frame);
    }
}
