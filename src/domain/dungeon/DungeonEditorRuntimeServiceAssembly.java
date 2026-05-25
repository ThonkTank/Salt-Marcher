package src.domain.dungeon;

import java.util.Objects;
import java.util.concurrent.atomic.AtomicReference;
import shell.api.ServiceRegistry;

final class DungeonEditorRuntimeServiceAssembly {

    private final AtomicReference<DungeonEditorRuntimeComponentServiceAssembly.EditorRuntimeComponent> editorRuntime =
            new AtomicReference<>();
    private final DungeonEditorPublishedStateServiceAssembly editorPublishedState;

    DungeonEditorRuntimeServiceAssembly(DungeonEditorPublishedStateServiceAssembly editorPublishedState) {
        this.editorPublishedState = Objects.requireNonNull(editorPublishedState, "editorPublishedState");
    }

    DungeonEditorMapApplicationService mapService(
            ServiceRegistry registry,
            DungeonAuthoredPublishedStateServiceAssembly publishedState
    ) {
        return component(registry, publishedState).mapService();
    }

    DungeonEditorProjectionApplicationService projectionService(
            ServiceRegistry registry,
            DungeonAuthoredPublishedStateServiceAssembly publishedState
    ) {
        return component(registry, publishedState).projectionService();
    }

    DungeonEditorPointerApplicationService pointerService(
            ServiceRegistry registry,
            DungeonAuthoredPublishedStateServiceAssembly publishedState
    ) {
        return component(registry, publishedState).pointerService();
    }

    DungeonEditorNarrationApplicationService narrationService(
            ServiceRegistry registry,
            DungeonAuthoredPublishedStateServiceAssembly publishedState
    ) {
        return component(registry, publishedState).narrationService();
    }

    private DungeonEditorRuntimeComponentServiceAssembly.EditorRuntimeComponent component(
            ServiceRegistry registry,
            DungeonAuthoredPublishedStateServiceAssembly publishedState
    ) {
        DungeonEditorRuntimeComponentServiceAssembly.EditorRuntimeComponent existing = editorRuntime.get();
        if (existing != null) {
            return existing;
        }
        DungeonEditorRuntimeComponentServiceAssembly.EditorRuntimeComponent candidate =
                DungeonEditorRuntimeComponentServiceAssembly.create(
                        Objects.requireNonNull(registry, "registry"),
                        publishedState,
                        editorPublishedState);
        return editorRuntime.compareAndSet(null, candidate)
                ? candidate
                : Objects.requireNonNull(editorRuntime.get(), "editorRuntime");
    }
}
