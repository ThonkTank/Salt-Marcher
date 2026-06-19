package src.features.dungeon.shell;

import java.util.Objects;
import src.domain.dungeon.published.DungeonEditorControlsModel;
import src.domain.dungeon.published.DungeonEditorControlsSnapshot;
import src.domain.dungeon.published.DungeonEditorMapSurfaceModel;
import src.domain.dungeon.published.DungeonEditorMapSurfaceSnapshot;
import src.domain.dungeon.published.DungeonEditorStateModel;
import src.domain.dungeon.published.DungeonEditorStateSnapshot;
import src.features.dungeon.runtime.DungeonEditorFeatureRuntimeRoot;
import src.features.dungeon.runtime.DungeonEditorRenderFrame;

public final class DungeonEditorFeatureShellBinding {
    private final DungeonEditorFeatureRuntimeRoot runtimeRoot;

    public DungeonEditorFeatureShellBinding(
            DungeonEditorControlsModel controlsModel,
            DungeonEditorMapSurfaceModel mapSurfaceModel,
            DungeonEditorStateModel stateModel
    ) {
        runtimeRoot = new DungeonEditorFeatureRuntimeRoot(
                controlsModel,
                mapSurfaceModel,
                stateModel);
    }

    public Runnable subscribe(PublicationSink sink) {
        PublicationSink safeSink = Objects.requireNonNull(sink, "sink");
        return runtimeRoot.subscribe(publication -> applyFrame(safeSink, publication.frame()));
    }

    public void publishCurrent(PublicationSink sink) {
        applyFrame(Objects.requireNonNull(sink, "sink"), runtimeRoot.currentPublication().frame());
    }

    private static void applyFrame(PublicationSink sink, DungeonEditorRenderFrame frame) {
        sink.apply(frame.controls(), frame.mapSurface(), frame.state());
    }

    @FunctionalInterface
    public interface PublicationSink {
        void apply(
                DungeonEditorControlsSnapshot controls,
                DungeonEditorMapSurfaceSnapshot mapSurface,
                DungeonEditorStateSnapshot state);
    }
}
