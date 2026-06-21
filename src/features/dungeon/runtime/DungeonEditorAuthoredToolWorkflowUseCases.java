package src.features.dungeon.runtime;

import java.util.Locale;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.graph.DungeonTopologyElementKind;
import src.domain.dungeon.model.core.graph.DungeonTopologyRef;
import src.domain.dungeon.model.core.structure.transition.TransitionDestination;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionValues;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorCreateFeatureMarkerUseCase;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorCreateStairUseCase;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorCreateTransitionUseCase;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorDeleteFeatureMarkerUseCase;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorDeleteStairUseCase;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorDeleteTransitionUseCase;
import src.features.dungeon.runtime.ApplyDungeonEditorToolWorkflowUseCase.PairedToolUseCases;
import src.features.dungeon.runtime.ApplyDungeonEditorToolWorkflowUseCase.PointerAction;
import src.features.dungeon.runtime.ApplyDungeonEditorToolWorkflowUseCase.PointerToolUseCase;
import src.features.dungeon.runtime.ApplyDungeonEditorToolWorkflowUseCase.ToolWorkflowUseCases;

final class DungeonEditorAuthoredToolWorkflowUseCases {
    private static final String DESTINATION_DUNGEON_MAP = "DUNGEON_MAP";
    private static final String DESTINATION_OVERWORLD_TILE = "OVERWORLD_TILE";

    private DungeonEditorAuthoredToolWorkflowUseCases() {
    }

    static ApplyDungeonEditorToolWorkflowUseCase create(DungeonEditorAuthoredRuntimeAssembly.RuntimeUseCases runtime) {
        DungeonEditorApplyToolUseCase toolUseCase =
                new DungeonEditorApplyToolUseCase(
                        runtime.workflow(),
                        runtime.mainViewInterpreter(),
                        runtime.effectUseCase(),
                        runtime.authored().applyOperationUseCase());
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
        PairedToolUseCases roomTools = paired(
                toolUseCase.roomWorkflow(DungeonEditorSessionValues.Tool.ROOM_PAINT),
                toolUseCase.roomWorkflow(DungeonEditorSessionValues.Tool.ROOM_DELETE));
        PairedToolUseCases doorTools = paired(
                toolUseCase.boundaryWorkflow(DungeonEditorSessionValues.Tool.DOOR_CREATE),
                toolUseCase.boundaryWorkflow(DungeonEditorSessionValues.Tool.DOOR_DELETE));
        PointerToolUseCase straightStairTools = workflowFor(
                input -> createStair.press(anchor(runtime.workflow(), input)),
                null,
                null,
                input -> createStair.hover(anchor(runtime.workflow(), input)));
        PointerToolUseCase squareStairTools = workflowFor(
                input -> createStair.pressSquare(anchor(runtime.workflow(), input)),
                null,
                null,
                input -> createStair.hoverSquare(anchor(runtime.workflow(), input)));
        PointerToolUseCase circularStairTools = workflowFor(
                input -> createStair.pressCircular(anchor(runtime.workflow(), input)),
                null,
                null,
                input -> createStair.hoverCircular(anchor(runtime.workflow(), input)));
        PointerToolUseCase stairDeleteTools = pressOnly(
                input -> deleteStair.press(targetRef(input, DungeonTopologyElementKind.STAIR)));
        PointerToolUseCase transitionCreateTools = pressOnly(
                input -> createTransition.press(anchor(runtime.workflow(), input), destination(input)));
        PointerToolUseCase transitionDeleteTools = pressOnly(
                input -> deleteTransition.press(targetRef(input, DungeonTopologyElementKind.TRANSITION)));
        PointerToolUseCase poiCreateTools = pressOnly(
                input -> createFeatureMarker.pressPoi(anchor(runtime.workflow(), input)));
        PointerToolUseCase objectCreateTools = pressOnly(
                input -> createFeatureMarker.pressObject(anchor(runtime.workflow(), input)));
        PointerToolUseCase encounterCreateTools = pressOnly(
                input -> createFeatureMarker.pressEncounter(anchor(runtime.workflow(), input)));
        PointerToolUseCase featureDeleteTools = pressOnly(
                input -> deleteFeatureMarker.press(targetRef(input, DungeonTopologyElementKind.FEATURE_MARKER)));
        return new ApplyDungeonEditorToolWorkflowUseCase(new ToolWorkflowUseCases(
                roomTools,
                doorTools,
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

    private static @Nullable Cell anchor(
            src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionWorkflow workflow,
            DungeonEditorMainViewInput input
    ) {
        if (input == null) {
            return null;
        }
        return new Cell(
                (int) Math.floor(input.canvasX()),
                (int) Math.floor(input.canvasY()),
                workflow.session().projectionLevel());
    }

    private static DungeonTopologyRef targetRef(
            DungeonEditorMainViewInput input,
            DungeonTopologyElementKind expectedKind
    ) {
        if (input == null) {
            return DungeonTopologyRef.empty();
        }
        DungeonTopologyRef target = input.target().topologyRef();
        return target.kind() == expectedKind ? target : DungeonTopologyRef.empty();
    }

    private static @Nullable TransitionDestination destination(DungeonEditorMainViewInput input) {
        if (input == null) {
            return null;
        }
        src.features.dungeon.runtime.DungeonEditorRuntimeOperations.TransitionDestination runtimeDestination =
                input.transitionDestination();
        String type = destinationType(runtimeDestination.destinationType());
        if (DESTINATION_DUNGEON_MAP.equals(type)) {
            return TransitionDestination.dungeonMap(
                    runtimeDestination.targetMapId(),
                    runtimeDestination.targetTransitionId() <= 0L ? null : runtimeDestination.targetTransitionId());
        }
        if (DESTINATION_OVERWORLD_TILE.equals(type)) {
            return TransitionDestination.overworldTile(
                    runtimeDestination.targetMapId(),
                    runtimeDestination.targetTileId());
        }
        return null;
    }

    private static @Nullable String destinationType(String value) {
        String normalized = value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
        if (normalized.isBlank()) {
            return DESTINATION_OVERWORLD_TILE;
        }
        if (DESTINATION_DUNGEON_MAP.equals(normalized)) {
            return DESTINATION_DUNGEON_MAP;
        }
        return DESTINATION_OVERWORLD_TILE.equals(normalized) ? DESTINATION_OVERWORLD_TILE : null;
    }
}
