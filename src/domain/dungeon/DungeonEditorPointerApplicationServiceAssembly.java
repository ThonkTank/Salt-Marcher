package src.domain.dungeon;

final class DungeonEditorPointerApplicationServiceAssembly {

    private DungeonEditorPointerApplicationServiceAssembly() {
    }

    static DungeonEditorPointerApplicationService create(
            DungeonEditorRuntimeFoundationServiceAssembly.RuntimeFoundation runtime
    ) {
        src.domain.dungeon.model.worldspace.usecase.ApplyDungeonEditorSelectionUseCase selection = selection(runtime);
        return new DungeonEditorPointerApplicationService(
                new src.domain.dungeon.model.worldspace.usecase.ApplyDungeonEditorToolWorkflowUseCase(
                        selection,
                        new src.domain.dungeon.model.worldspace.usecase.ApplyDungeonEditorPaintRoomUseCase(
                                runtime.workflow(),
                                runtime.mainViewInterpreter(),
                                runtime.effectUseCase()),
                        new src.domain.dungeon.model.worldspace.usecase.ApplyDungeonEditorDeleteRoomUseCase(
                                runtime.workflow(),
                                runtime.mainViewInterpreter(),
                                runtime.effectUseCase()),
                        new src.domain.dungeon.model.worldspace.usecase.ApplyDungeonEditorCreateWallUseCase(
                                runtime.workflow(),
                                runtime.mainViewInterpreter(),
                                runtime.effectUseCase()),
                        new src.domain.dungeon.model.worldspace.usecase.ApplyDungeonEditorDeleteWallUseCase(
                                runtime.workflow(),
                                runtime.mainViewInterpreter(),
                                runtime.effectUseCase()),
                        new src.domain.dungeon.model.worldspace.usecase.ApplyDungeonEditorCreateDoorUseCase(
                                runtime.workflow(),
                                runtime.mainViewInterpreter(),
                                runtime.effectUseCase()),
                        new src.domain.dungeon.model.worldspace.usecase.ApplyDungeonEditorDeleteDoorUseCase(
                                runtime.workflow(),
                                runtime.mainViewInterpreter(),
                                runtime.effectUseCase()),
                        new src.domain.dungeon.model.worldspace.usecase.ApplyDungeonEditorCreateCorridorUseCase(
                                runtime.workflow(),
                                runtime.mainViewInterpreter(),
                                runtime.effectUseCase()),
                        new src.domain.dungeon.model.worldspace.usecase.ApplyDungeonEditorDeleteCorridorUseCase(
                                runtime.workflow(),
                                runtime.mainViewInterpreter(),
                                runtime.effectUseCase())),
                selection);
    }

    private static src.domain.dungeon.model.worldspace.usecase.ApplyDungeonEditorSelectionUseCase selection(
            DungeonEditorRuntimeFoundationServiceAssembly.RuntimeFoundation runtime
    ) {
        return new src.domain.dungeon.model.worldspace.usecase.ApplyDungeonEditorSelectionUseCase(
                runtime.workflow(),
                runtime.mainViewInterpreter(),
                runtime.effectUseCase());
    }
}
