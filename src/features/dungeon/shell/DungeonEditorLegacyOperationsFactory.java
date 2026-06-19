package src.features.dungeon.shell;

import shell.api.ShellRuntimeContext;
import src.domain.dungeon.DungeonEditorLabelNameApplicationService;
import src.domain.dungeon.DungeonEditorMapApplicationService;
import src.domain.dungeon.DungeonEditorNarrationApplicationService;
import src.domain.dungeon.DungeonEditorPointerApplicationService;
import src.domain.dungeon.DungeonEditorProjectionApplicationService;
import src.domain.dungeon.DungeonEditorStairApplicationService;
import src.domain.dungeon.DungeonEditorTransitionApplicationService;

final class DungeonEditorLegacyOperationsFactory {
    private DungeonEditorLegacyOperationsFactory() {
    }

    static DungeonEditorLegacyMapOperations createMap(ShellRuntimeContext runtimeContext) {
        return new DungeonEditorLegacyMapOperations(
                runtimeContext.services().require(DungeonEditorMapApplicationService.class));
    }

    static DungeonEditorLegacyProjectionOperations createProjection(ShellRuntimeContext runtimeContext) {
        return new DungeonEditorLegacyProjectionOperations(
                runtimeContext.services().require(DungeonEditorProjectionApplicationService.class));
    }

    static DungeonEditorLegacyPointerOperations createPointer(ShellRuntimeContext runtimeContext) {
        return new DungeonEditorLegacyPointerOperations(
                runtimeContext.services().require(DungeonEditorPointerApplicationService.class));
    }

    static DungeonEditorLegacyDetailOperations createDetails(ShellRuntimeContext runtimeContext) {
        return new DungeonEditorLegacyDetailOperations(
                runtimeContext.services().require(DungeonEditorNarrationApplicationService.class),
                runtimeContext.services().require(DungeonEditorLabelNameApplicationService.class),
                runtimeContext.services().require(DungeonEditorTransitionApplicationService.class),
                runtimeContext.services().require(DungeonEditorStairApplicationService.class));
    }
}
