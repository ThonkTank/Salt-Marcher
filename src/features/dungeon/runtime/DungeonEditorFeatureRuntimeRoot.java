package src.features.dungeon.runtime;

import java.util.Objects;
import java.util.function.Consumer;
import src.domain.dungeon.published.DungeonEditorControlsModel;
import src.domain.dungeon.published.DungeonEditorMapSurfaceModel;
import src.domain.dungeon.published.DungeonEditorStateModel;

public final class DungeonEditorFeatureRuntimeRoot {
    private final DungeonEditorControlsModel controlsModel;
    private final DungeonEditorMapSurfaceModel mapSurfaceModel;
    private final DungeonEditorStateModel stateModel;

    public DungeonEditorFeatureRuntimeRoot(
            DungeonEditorControlsModel controlsModel,
            DungeonEditorMapSurfaceModel mapSurfaceModel,
            DungeonEditorStateModel stateModel
    ) {
        this.controlsModel = Objects.requireNonNull(controlsModel, "controlsModel");
        this.mapSurfaceModel = Objects.requireNonNull(mapSurfaceModel, "mapSurfaceModel");
        this.stateModel = Objects.requireNonNull(stateModel, "stateModel");
    }

    public DungeonEditorRuntimePublication currentPublication() {
        return DungeonEditorRuntimePublication.published(currentFrame());
    }

    public Runnable subscribe(Consumer<DungeonEditorRuntimePublication> subscriber) {
        Consumer<DungeonEditorRuntimePublication> safeSubscriber =
                Objects.requireNonNull(subscriber, "subscriber");
        return stateModel.subscribe(ignored -> safeSubscriber.accept(currentPublication()));
    }

    private DungeonEditorRenderFrame currentFrame() {
        return new DungeonEditorRenderFrame(
                controlsModel.current(),
                mapSurfaceModel.current(),
                stateModel.current());
    }
}
