package src.features.dungeon.shell;

import java.util.Objects;
import shell.api.ShellRuntimeContext;
import src.domain.dungeon.published.DungeonEditorControlsModel;
import src.domain.dungeon.published.DungeonEditorControlsSnapshot;
import src.domain.dungeon.published.DungeonEditorMapSurfaceModel;
import src.domain.dungeon.published.DungeonEditorMapSurfaceSnapshot;
import src.domain.dungeon.published.DungeonEditorStateModel;
import src.domain.dungeon.published.DungeonEditorStateSnapshot;
import src.features.dungeon.runtime.DungeonEditorFeatureRuntimeRoot;
import src.features.dungeon.runtime.DungeonEditorRenderFrame;
import src.features.dungeon.runtime.DungeonEditorRuntimeOperations;

public final class DungeonEditorFeatureShellBinding {
    private final DungeonEditorFeatureRuntimeRoot runtimeRoot;
    private final DungeonEditorLegacyMapOperations mapOperations;
    private final DungeonEditorLegacyProjectionOperations projectionOperations;
    private final DungeonEditorLegacyPointerOperations pointerOperations;
    private final DungeonEditorLegacyDetailOperations detailOperations;

    public DungeonEditorFeatureShellBinding(ShellRuntimeContext runtimeContext) {
        ShellRuntimeContext safeRuntimeContext = Objects.requireNonNull(runtimeContext, "runtimeContext");
        DungeonEditorControlsModel controlsModel =
                safeRuntimeContext.services().require(DungeonEditorControlsModel.class);
        DungeonEditorMapSurfaceModel mapSurfaceModel =
                safeRuntimeContext.services().require(DungeonEditorMapSurfaceModel.class);
        DungeonEditorStateModel stateModel =
                safeRuntimeContext.services().require(DungeonEditorStateModel.class);
        runtimeRoot = new DungeonEditorFeatureRuntimeRoot(
                controlsModel,
                mapSurfaceModel,
                stateModel);
        mapOperations = DungeonEditorLegacyOperationsFactory.createMap(safeRuntimeContext);
        projectionOperations = DungeonEditorLegacyOperationsFactory.createProjection(safeRuntimeContext);
        pointerOperations = DungeonEditorLegacyOperationsFactory.createPointer(safeRuntimeContext);
        detailOperations = DungeonEditorLegacyOperationsFactory.createDetails(safeRuntimeContext);
    }

    public DungeonEditorRuntimeOperations operations() {
        return new DungeonEditorLegacyOperations(
                mapOperations,
                projectionOperations,
                pointerOperations,
                detailOperations);
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
