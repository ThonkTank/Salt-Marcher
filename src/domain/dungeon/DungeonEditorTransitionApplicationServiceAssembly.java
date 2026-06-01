package src.domain.dungeon;

final class DungeonEditorTransitionApplicationServiceAssembly {

    private DungeonEditorTransitionApplicationServiceAssembly() {
    }

    static DungeonEditorTransitionApplicationService create(
            DungeonEditorRuntimeFoundationServiceAssembly.RuntimeFoundation runtime
    ) {
        return new DungeonEditorTransitionApplicationService(
                new src.domain.dungeon.model.worldspace.usecase.SaveDungeonEditorTransitionDescriptionUseCase(
                        runtime.workflow(),
                        runtime.authoredUseCases().saveTransitionDescriptionUseCase(),
                        runtime.effectUseCase()),
                new src.domain.dungeon.model.worldspace.usecase.SaveDungeonEditorTransitionLinkUseCase(
                        runtime.workflow(),
                        runtime.authoredUseCases().saveTransitionLinkUseCase(),
                        runtime.effectUseCase()));
    }
}
