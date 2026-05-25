package src.domain.dungeon;

final class DungeonEditorMapApplicationServiceAssembly {

    private DungeonEditorMapApplicationServiceAssembly() {
    }

    static DungeonEditorMapApplicationService create(
            DungeonEditorRuntimeFoundationServiceAssembly.RuntimeFoundation runtime
    ) {
        DungeonEditorAuthoredUseCasesServiceAssembly.AuthoredUseCases authored = runtime.authoredUseCases();
        return new DungeonEditorMapApplicationService(
                new src.domain.dungeon.model.worldspace.usecase.SelectDungeonEditorMapUseCase(
                        runtime.workflow(),
                        runtime.snapshotBuilder(),
                        runtime.mainViewInterpreter(),
                        runtime.snapshotPublicationUseCase()),
                new src.domain.dungeon.model.worldspace.usecase.CreateDungeonEditorMapUseCase(
                        runtime.workflow(),
                        authored.createMapUseCase(),
                        runtime.dungeonState(),
                        runtime.snapshotBuilder(),
                        runtime.mainViewInterpreter(),
                        runtime.snapshotPublicationUseCase()),
                new src.domain.dungeon.model.worldspace.usecase.RenameDungeonEditorMapUseCase(
                        runtime.workflow(),
                        authored.renameMapUseCase(),
                        runtime.dungeonState(),
                        runtime.snapshotBuilder(),
                        runtime.snapshotPublicationUseCase()),
                new src.domain.dungeon.model.worldspace.usecase.DeleteDungeonEditorMapUseCase(
                        runtime.workflow(),
                        authored.deleteMapUseCase(),
                        runtime.dungeonState(),
                        runtime.snapshotBuilder(),
                        runtime.mainViewInterpreter(),
                        runtime.snapshotPublicationUseCase()));
    }
}
