package src.domain.dungeon;

final class DungeonEditorLabelNameApplicationServiceAssembly {

    private DungeonEditorLabelNameApplicationServiceAssembly() {
    }

    static DungeonEditorLabelNameApplicationService create(
            DungeonEditorRuntimeFoundationServiceAssembly.RuntimeFoundation runtime
    ) {
        return new DungeonEditorLabelNameApplicationService(
                new src.domain.dungeon.model.runtime.usecase.SaveDungeonEditorLabelNameUseCase(
                        runtime.workflow(),
                        runtime.authoredUseCases().saveLabelNameUseCase(),
                        runtime.effectUseCase()));
    }
}
