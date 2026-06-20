package src.features.dungeon.shell;

import java.util.Objects;
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
        return runtimeRoot.subscribe(publication -> safeSink.apply(publication.frame()));
    }

    public void publishCurrent(PublicationSink sink) {
        Objects.requireNonNull(sink, "sink").apply(runtimeRoot.currentPublication().frame());
    }

    @FunctionalInterface
    public interface PublicationSink {
        void apply(DungeonEditorRenderFrame frame);
    }
}
