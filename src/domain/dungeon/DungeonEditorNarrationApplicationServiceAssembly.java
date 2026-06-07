package src.domain.dungeon;

final class DungeonEditorNarrationApplicationServiceAssembly {

    private DungeonEditorNarrationApplicationServiceAssembly() {
    }

    static DungeonEditorNarrationApplicationService create(
            DungeonEditorRuntimeFoundationServiceAssembly.RuntimeFoundation runtime
    ) {
        return new DungeonEditorNarrationApplicationService(
                new src.domain.dungeon.model.runtime.usecase.SaveDungeonEditorRoomNarrationUseCase(
                        runtime.workflow(),
                        runtime.authoredUseCases().saveRoomNarrationUseCase(),
                        runtime.effectUseCase()));
    }
}
