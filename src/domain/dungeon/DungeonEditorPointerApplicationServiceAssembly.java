package src.domain.dungeon;

import src.domain.dungeon.model.worldspace.usecase.ApplyDungeonEditorToolWorkflowUseCase.PairedToolUseCases;
import src.domain.dungeon.model.worldspace.usecase.ApplyDungeonEditorToolWorkflowUseCase.PointerAction;
import src.domain.dungeon.model.worldspace.usecase.ApplyDungeonEditorToolWorkflowUseCase.PointerToolUseCase;
import src.domain.dungeon.model.worldspace.usecase.ApplyDungeonEditorToolWorkflowUseCase.ToolWorkflowUseCases;

final class DungeonEditorPointerApplicationServiceAssembly {

    private DungeonEditorPointerApplicationServiceAssembly() {
    }

    static DungeonEditorPointerApplicationService create(
            DungeonEditorRuntimeFoundationServiceAssembly.RuntimeFoundation runtime
    ) {
        src.domain.dungeon.model.worldspace.usecase.ApplyDungeonEditorSelectionUseCase selection = selection(runtime);
        return new DungeonEditorPointerApplicationService(
                toolWorkflow(runtime, selection),
                selection,
                new src.domain.dungeon.model.worldspace.usecase.MoveDungeonEditorHandleUseCase(
                        runtime.workflow(),
                        runtime.effectUseCase()));
    }

    private static src.domain.dungeon.model.worldspace.usecase.ApplyDungeonEditorSelectionUseCase selection(
            DungeonEditorRuntimeFoundationServiceAssembly.RuntimeFoundation runtime
    ) {
        return new src.domain.dungeon.model.worldspace.usecase.ApplyDungeonEditorSelectionUseCase(
                runtime.workflow(),
                runtime.mainViewInterpreter(),
                runtime.effectUseCase());
    }

    private static src.domain.dungeon.model.worldspace.usecase.ApplyDungeonEditorToolWorkflowUseCase toolWorkflow(
            DungeonEditorRuntimeFoundationServiceAssembly.RuntimeFoundation runtime,
            src.domain.dungeon.model.worldspace.usecase.ApplyDungeonEditorSelectionUseCase selection
    ) {
        src.domain.dungeon.model.worldspace.usecase.ApplyDungeonEditorPaintRoomUseCase paintRoom =
                new src.domain.dungeon.model.worldspace.usecase.ApplyDungeonEditorPaintRoomUseCase(
                        runtime.workflow(),
                        runtime.mainViewInterpreter(),
                        runtime.effectUseCase());
        src.domain.dungeon.model.worldspace.usecase.ApplyDungeonEditorDeleteRoomUseCase deleteRoom =
                new src.domain.dungeon.model.worldspace.usecase.ApplyDungeonEditorDeleteRoomUseCase(
                        runtime.workflow(),
                        runtime.mainViewInterpreter(),
                        runtime.effectUseCase());
        src.domain.dungeon.model.worldspace.usecase.ApplyDungeonEditorCreateWallUseCase createWall =
                new src.domain.dungeon.model.worldspace.usecase.ApplyDungeonEditorCreateWallUseCase(
                        runtime.workflow(),
                        runtime.mainViewInterpreter(),
                        runtime.effectUseCase());
        src.domain.dungeon.model.worldspace.usecase.ApplyDungeonEditorDeleteWallUseCase deleteWall =
                new src.domain.dungeon.model.worldspace.usecase.ApplyDungeonEditorDeleteWallUseCase(
                        runtime.workflow(),
                        runtime.mainViewInterpreter(),
                        runtime.effectUseCase());
        src.domain.dungeon.model.worldspace.usecase.ApplyDungeonEditorCreateDoorUseCase createDoor =
                new src.domain.dungeon.model.worldspace.usecase.ApplyDungeonEditorCreateDoorUseCase(
                        runtime.workflow(),
                        runtime.mainViewInterpreter(),
                        runtime.effectUseCase());
        src.domain.dungeon.model.worldspace.usecase.ApplyDungeonEditorDeleteDoorUseCase deleteDoor =
                new src.domain.dungeon.model.worldspace.usecase.ApplyDungeonEditorDeleteDoorUseCase(
                        runtime.workflow(),
                        runtime.mainViewInterpreter(),
                        runtime.effectUseCase());
        src.domain.dungeon.model.worldspace.usecase.ApplyDungeonEditorCreateCorridorUseCase createCorridor =
                new src.domain.dungeon.model.worldspace.usecase.ApplyDungeonEditorCreateCorridorUseCase(
                        runtime.workflow(),
                        runtime.mainViewInterpreter(),
                        runtime.effectUseCase());
        src.domain.dungeon.model.worldspace.usecase.ApplyDungeonEditorDeleteCorridorUseCase deleteCorridor =
                new src.domain.dungeon.model.worldspace.usecase.ApplyDungeonEditorDeleteCorridorUseCase(
                        runtime.workflow(),
                        runtime.mainViewInterpreter(),
                        runtime.effectUseCase());
        src.domain.dungeon.model.worldspace.usecase.ApplyDungeonEditorCreateStairUseCase createStair =
                new src.domain.dungeon.model.worldspace.usecase.ApplyDungeonEditorCreateStairUseCase(
                        runtime.workflow(),
                        runtime.authoredUseCases().createStairUseCase(),
                        runtime.effectUseCase());
        src.domain.dungeon.model.worldspace.usecase.ApplyDungeonEditorDeleteStairUseCase deleteStair =
                new src.domain.dungeon.model.worldspace.usecase.ApplyDungeonEditorDeleteStairUseCase(
                        runtime.workflow(),
                        runtime.authoredUseCases().deleteStairUseCase(),
                        runtime.effectUseCase());
        src.domain.dungeon.model.worldspace.usecase.ApplyDungeonEditorCreateTransitionUseCase createTransition =
                new src.domain.dungeon.model.worldspace.usecase.ApplyDungeonEditorCreateTransitionUseCase(
                        runtime.workflow(),
                        runtime.authoredUseCases().createTransitionUseCase(),
                        runtime.effectUseCase());
        src.domain.dungeon.model.worldspace.usecase.ApplyDungeonEditorDeleteTransitionUseCase deleteTransition =
                new src.domain.dungeon.model.worldspace.usecase.ApplyDungeonEditorDeleteTransitionUseCase(
                        runtime.workflow(),
                        runtime.authoredUseCases().deleteTransitionUseCase(),
                        runtime.effectUseCase());
        return new src.domain.dungeon.model.worldspace.usecase.ApplyDungeonEditorToolWorkflowUseCase(
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
