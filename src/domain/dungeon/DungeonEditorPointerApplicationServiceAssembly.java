package src.domain.dungeon;

import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorToolWorkflowUseCase.PairedToolUseCases;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorToolWorkflowUseCase.PointerAction;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorToolWorkflowUseCase.PointerToolUseCase;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorToolWorkflowUseCase.ToolWorkflowUseCases;

final class DungeonEditorPointerApplicationServiceAssembly {

    private DungeonEditorPointerApplicationServiceAssembly() {
    }

    static DungeonEditorPointerApplicationService create(
            DungeonEditorRuntimeFoundationServiceAssembly.RuntimeFoundation runtime
    ) {
        src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorSelectionUseCase selection = selection(runtime);
        return new DungeonEditorPointerApplicationService(
                toolWorkflow(runtime, selection),
                selection,
                new src.domain.dungeon.model.runtime.usecase.MoveDungeonEditorHandleUseCase(
                        runtime.workflow(),
                        runtime.effectUseCase()));
    }

    private static src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorSelectionUseCase selection(
            DungeonEditorRuntimeFoundationServiceAssembly.RuntimeFoundation runtime
    ) {
        return new src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorSelectionUseCase(
                runtime.workflow(),
                runtime.mainViewInterpreter(),
                runtime.effectUseCase());
    }

    private static src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorToolWorkflowUseCase toolWorkflow(
            DungeonEditorRuntimeFoundationServiceAssembly.RuntimeFoundation runtime,
            src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorSelectionUseCase selection
    ) {
        src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorPaintRoomUseCase paintRoom =
                new src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorPaintRoomUseCase(
                        runtime.workflow(),
                        runtime.mainViewInterpreter(),
                        runtime.effectUseCase());
        src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorDeleteRoomUseCase deleteRoom =
                new src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorDeleteRoomUseCase(
                        runtime.workflow(),
                        runtime.mainViewInterpreter(),
                        runtime.effectUseCase());
        src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorCreateWallUseCase createWall =
                new src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorCreateWallUseCase(
                        runtime.workflow(),
                        runtime.mainViewInterpreter(),
                        runtime.effectUseCase());
        src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorDeleteWallUseCase deleteWall =
                new src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorDeleteWallUseCase(
                        runtime.workflow(),
                        runtime.mainViewInterpreter(),
                        runtime.effectUseCase());
        src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorCreateDoorUseCase createDoor =
                new src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorCreateDoorUseCase(
                        runtime.workflow(),
                        runtime.mainViewInterpreter(),
                        runtime.effectUseCase());
        src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorDeleteDoorUseCase deleteDoor =
                new src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorDeleteDoorUseCase(
                        runtime.workflow(),
                        runtime.mainViewInterpreter(),
                        runtime.effectUseCase());
        src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorCreateCorridorUseCase createCorridor =
                new src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorCreateCorridorUseCase(
                        runtime.workflow(),
                        runtime.mainViewInterpreter(),
                        runtime.effectUseCase());
        src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorDeleteCorridorUseCase deleteCorridor =
                new src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorDeleteCorridorUseCase(
                        runtime.workflow(),
                        runtime.mainViewInterpreter(),
                        runtime.effectUseCase());
        src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorCreateStairUseCase createStair =
                new src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorCreateStairUseCase(
                        runtime.workflow(),
                        runtime.authoredUseCases().createStairUseCase(),
                        runtime.effectUseCase());
        src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorDeleteStairUseCase deleteStair =
                new src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorDeleteStairUseCase(
                        runtime.workflow(),
                        runtime.authoredUseCases().deleteStairUseCase(),
                        runtime.effectUseCase());
        src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorCreateTransitionUseCase createTransition =
                new src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorCreateTransitionUseCase(
                        runtime.workflow(),
                        runtime.authoredUseCases().createTransitionUseCase(),
                        runtime.effectUseCase());
        src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorDeleteTransitionUseCase deleteTransition =
                new src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorDeleteTransitionUseCase(
                        runtime.workflow(),
                        runtime.authoredUseCases().deleteTransitionUseCase(),
                        runtime.effectUseCase());
        return new src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorToolWorkflowUseCase(
                new ToolWorkflowUseCases(
                        pointer(selection::press, selection::drag, selection::release, selection::hover),
                        new PairedToolUseCases(
                                pointer(paintRoom::press, paintRoom::drag, paintRoom::release, null),
                                pointer(deleteRoom::press, deleteRoom::drag, deleteRoom::release, null)),
                        new PairedToolUseCases(
                                pointer(createWall::press, createWall::drag, createWall::release, createWall::hover),
                                pointer(deleteWall::press, deleteWall::drag, deleteWall::release, deleteWall::hover)),
                        new PairedToolUseCases(
                                pointer(createDoor::press, createDoor::drag, createDoor::release, createDoor::hover),
                                pointer(deleteDoor::press, deleteDoor::drag, deleteDoor::release, deleteDoor::hover)),
                        new PairedToolUseCases(
                                pointer(createCorridor::press, null, null, createCorridor::hover),
                                pointer(deleteCorridor::press, null, null, deleteCorridor::hover)),
                        pointer(createStair::press, null, null, null),
                        pointer(createStair::pressSquare, null, null, null),
                        pointer(createStair::pressCircular, null, null, null),
                        pointer(deleteStair::press, null, null, null),
                        pointer(createTransition::press, null, null, null),
                        pointer(deleteTransition::press, null, null, null)));
    }

    private static PointerToolUseCase pointer(
            PointerAction press,
            PointerAction drag,
            PointerAction release,
            PointerAction hover
    ) {
        return new PointerToolUseCase(press, drag, release, hover);
    }
}
