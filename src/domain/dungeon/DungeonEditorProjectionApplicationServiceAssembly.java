package src.domain.dungeon;

final class DungeonEditorProjectionApplicationServiceAssembly {

    private DungeonEditorProjectionApplicationServiceAssembly() {
    }

    static DungeonEditorProjectionApplicationService create(
            DungeonEditorRuntimeFoundationServiceAssembly.RuntimeFoundation runtime
    ) {
        return new DungeonEditorProjectionApplicationService(
                new src.domain.dungeon.model.runtime.usecase.SetDungeonEditorViewModeUseCase(
                        runtime.workflow(),
                        runtime.snapshotBuilder(),
                        runtime.mainViewInterpreter(),
                        runtime.snapshotPublicationUseCase()),
                new src.domain.dungeon.model.runtime.usecase.SetDungeonEditorToolUseCase(
                        runtime.workflow(),
                        runtime.mainViewInterpreter(),
                        runtime.snapshotPublicationUseCase()),
                new src.domain.dungeon.model.runtime.usecase.ShiftDungeonEditorProjectionLevelUseCase(
                        runtime.workflow(),
                        runtime.snapshotBuilder(),
                        runtime.snapshotPublicationUseCase()),
                new src.domain.dungeon.model.runtime.usecase.SetDungeonEditorOverlayUseCase(
                        runtime.workflow(),
                        runtime.snapshotBuilder(),
                        runtime.snapshotPublicationUseCase()));
    }
}
