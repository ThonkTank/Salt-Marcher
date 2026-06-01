package src.domain.dungeon;

final class DungeonEditorStairApplicationServiceAssembly {

    private DungeonEditorStairApplicationServiceAssembly() {
    }

    static DungeonEditorStairApplicationService create(
            DungeonEditorRuntimeFoundationServiceAssembly.RuntimeFoundation runtime
    ) {
        return new DungeonEditorStairApplicationService(
                new src.domain.dungeon.model.worldspace.usecase.SaveDungeonEditorStairGeometryUseCase(
                        runtime.workflow(),
                        runtime.authoredUseCases().saveStairGeometryUseCase(),
                        runtime.effectUseCase()));
    }
}
