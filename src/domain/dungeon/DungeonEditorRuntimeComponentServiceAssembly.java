package src.domain.dungeon;

import shell.api.ServiceRegistry;

final class DungeonEditorRuntimeComponentServiceAssembly {

    private DungeonEditorRuntimeComponentServiceAssembly() {
    }

    static EditorRuntimeComponent create(
            ServiceRegistry registry,
            DungeonAuthoredPublishedStateServiceAssembly publishedState,
            DungeonEditorPublishedStateServiceAssembly editorPublishedState
    ) {
        DungeonEditorRuntimeFoundationServiceAssembly.RuntimeFoundation runtime =
                DungeonEditorRuntimeFoundationServiceAssembly.create(registry, publishedState, editorPublishedState);
        return new EditorRuntimeComponent(
                DungeonEditorMapApplicationServiceAssembly.create(runtime),
                DungeonEditorProjectionApplicationServiceAssembly.create(runtime),
                DungeonEditorPointerApplicationServiceAssembly.create(runtime),
                DungeonEditorNarrationApplicationServiceAssembly.create(runtime),
                DungeonEditorTransitionApplicationServiceAssembly.create(runtime),
                DungeonEditorStairApplicationServiceAssembly.create(runtime));
    }

    record EditorRuntimeComponent(
            DungeonEditorMapApplicationService mapService,
            DungeonEditorProjectionApplicationService projectionService,
            DungeonEditorPointerApplicationService pointerService,
            DungeonEditorNarrationApplicationService narrationService,
            DungeonEditorTransitionApplicationService transitionService,
            DungeonEditorStairApplicationService stairService
    ) {
    }
}
