package src.features.dungeon.runtime;

import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorCreateCorridorUseCase;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorCreateDoorUseCase;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorCreateFeatureMarkerUseCase;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorCreateStairUseCase;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorCreateTransitionUseCase;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorDeleteCorridorUseCase;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorDeleteDoorUseCase;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorDeleteFeatureMarkerUseCase;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorDeleteRoomUseCase;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorDeleteStairUseCase;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorDeleteTransitionUseCase;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorPaintRoomUseCase;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorSelectionUseCase;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorToolWorkflowUseCase;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorToolWorkflowUseCase.PairedToolUseCases;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorToolWorkflowUseCase.PointerAction;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorToolWorkflowUseCase.PointerToolUseCase;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorToolWorkflowUseCase.ToolWorkflowUseCases;

final class DungeonEditorAuthoredToolWorkflowUseCases {

    private DungeonEditorAuthoredToolWorkflowUseCases() {
    }

    static ApplyDungeonEditorToolWorkflowUseCase create(
            DungeonEditorAuthoredRuntimeAssembly.RuntimeUseCases runtime,
            ApplyDungeonEditorSelectionUseCase selection
    ) {
        ApplyDungeonEditorPaintRoomUseCase paintRoom =
                new ApplyDungeonEditorPaintRoomUseCase(
                        runtime.workflow(),
                        runtime.mainViewInterpreter(),
                        runtime.effectUseCase());
        ApplyDungeonEditorDeleteRoomUseCase deleteRoom =
                new ApplyDungeonEditorDeleteRoomUseCase(
                        runtime.workflow(),
                        runtime.mainViewInterpreter(),
                        runtime.effectUseCase());
        ApplyDungeonEditorCreateDoorUseCase createDoor =
                new ApplyDungeonEditorCreateDoorUseCase(
                        runtime.workflow(),
                        runtime.mainViewInterpreter(),
                        runtime.effectUseCase());
        ApplyDungeonEditorDeleteDoorUseCase deleteDoor =
                new ApplyDungeonEditorDeleteDoorUseCase(
                        runtime.workflow(),
                        runtime.mainViewInterpreter(),
                        runtime.effectUseCase());
        ApplyDungeonEditorCreateCorridorUseCase createCorridor =
                new ApplyDungeonEditorCreateCorridorUseCase(
                        runtime.workflow(),
                        runtime.mainViewInterpreter(),
                        runtime.effectUseCase());
        ApplyDungeonEditorDeleteCorridorUseCase deleteCorridor =
                new ApplyDungeonEditorDeleteCorridorUseCase(
                        runtime.workflow(),
                        runtime.mainViewInterpreter(),
                        runtime.effectUseCase());
        ApplyDungeonEditorCreateStairUseCase createStair =
                new ApplyDungeonEditorCreateStairUseCase(
                        runtime.workflow(),
                        runtime.authored().createStairUseCase(),
                        runtime.effectUseCase());
        ApplyDungeonEditorDeleteStairUseCase deleteStair =
                new ApplyDungeonEditorDeleteStairUseCase(
                        runtime.workflow(),
                        runtime.authored().deleteStairUseCase(),
                        runtime.effectUseCase());
        ApplyDungeonEditorCreateTransitionUseCase createTransition =
                new ApplyDungeonEditorCreateTransitionUseCase(
                        runtime.workflow(),
                        runtime.authored().createTransitionUseCase(),
                        runtime.effectUseCase());
        ApplyDungeonEditorDeleteTransitionUseCase deleteTransition =
                new ApplyDungeonEditorDeleteTransitionUseCase(
                        runtime.workflow(),
                        runtime.authored().deleteTransitionUseCase(),
                        runtime.effectUseCase());
        ApplyDungeonEditorCreateFeatureMarkerUseCase createFeatureMarker =
                new ApplyDungeonEditorCreateFeatureMarkerUseCase(
                        runtime.workflow(),
                        runtime.authored().createFeatureMarkerUseCase(),
                        runtime.effectUseCase());
        ApplyDungeonEditorDeleteFeatureMarkerUseCase deleteFeatureMarker =
                new ApplyDungeonEditorDeleteFeatureMarkerUseCase(
                        runtime.workflow(),
                        runtime.authored().deleteFeatureMarkerUseCase(),
                        runtime.effectUseCase());
        PointerToolUseCase selectionTools = workflowFor(
                selection::press,
                selection::drag,
                selection::release,
                selection::hover);
        PairedToolUseCases roomTools = paired(
                workflowFor(paintRoom::press, paintRoom::drag, paintRoom::release, null),
                workflowFor(deleteRoom::press, deleteRoom::drag, deleteRoom::release, null));
        PairedToolUseCases doorTools = paired(
                workflowFor(createDoor::press, createDoor::drag, createDoor::release, createDoor::hover),
                workflowFor(deleteDoor::press, deleteDoor::drag, deleteDoor::release, deleteDoor::hover));
        PairedToolUseCases corridorTools = paired(
                workflowFor(createCorridor::press, null, null, createCorridor::hover),
                workflowFor(deleteCorridor::press, null, null, deleteCorridor::hover));
        PointerToolUseCase straightStairTools = workflowFor(createStair::press, null, null, createStair::hover);
        PointerToolUseCase squareStairTools = workflowFor(createStair::pressSquare, null, null, createStair::hoverSquare);
        PointerToolUseCase circularStairTools = workflowFor(
                createStair::pressCircular,
                null,
                null,
                createStair::hoverCircular);
        PointerToolUseCase stairDeleteTools = pressOnly(deleteStair::press);
        PointerToolUseCase transitionCreateTools = pressOnly(createTransition::press);
        PointerToolUseCase transitionDeleteTools = pressOnly(deleteTransition::press);
        PointerToolUseCase poiCreateTools = pressOnly(createFeatureMarker::pressPoi);
        PointerToolUseCase objectCreateTools = pressOnly(createFeatureMarker::pressObject);
        PointerToolUseCase encounterCreateTools = pressOnly(createFeatureMarker::pressEncounter);
        PointerToolUseCase featureDeleteTools = pressOnly(deleteFeatureMarker::press);
        return new ApplyDungeonEditorToolWorkflowUseCase(new ToolWorkflowUseCases(
                selectionTools,
                roomTools,
                doorTools,
                corridorTools,
                straightStairTools,
                squareStairTools,
                circularStairTools,
                stairDeleteTools,
                transitionCreateTools,
                transitionDeleteTools,
                poiCreateTools,
                objectCreateTools,
                encounterCreateTools,
                featureDeleteTools));
    }

    private static PointerToolUseCase workflowFor(
            PointerAction press,
            PointerAction drag,
            PointerAction release,
            PointerAction hover
    ) {
        return new PointerToolUseCase(press, drag, release, hover);
    }

    private static PointerToolUseCase pressOnly(PointerAction press) {
        return workflowFor(press, null, null, null);
    }

    private static PairedToolUseCases paired(PointerToolUseCase primary, PointerToolUseCase delete) {
        return new PairedToolUseCases(primary, delete);
    }
}
