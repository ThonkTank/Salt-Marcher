package src.domain.dungeon.model.runtime.usecase;

import java.util.EnumMap;
import java.util.Map;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.runtime.usecase.BuildDungeonEditorMainViewInputUseCase.MainViewInput;

public final class ApplyDungeonEditorToolWorkflowUseCase {

    private final Map<ToolInput, ToolWorkflow> workflows;

    public ApplyDungeonEditorToolWorkflowUseCase(ToolWorkflowUseCases useCases) {
        Map<ToolInput, ToolWorkflow> registeredWorkflows = new EnumMap<>(ToolInput.class);
        ToolWorkflowUseCases safeUseCases = Objects.requireNonNull(useCases, "useCases");
        registeredWorkflows.put(
                ToolInput.SELECT,
                safeUseCases.selection().workflow());
        registeredWorkflows.put(
                ToolInput.ROOM_PAINT,
                        safeUseCases.room().primary().withoutHover());
        registeredWorkflows.put(
                ToolInput.ROOM_DELETE,
                        safeUseCases.room().delete().withoutHover());
        registeredWorkflows.put(
                ToolInput.WALL_CREATE,
                        safeUseCases.wall().primary().workflow());
        registeredWorkflows.put(
                ToolInput.WALL_DELETE,
                        safeUseCases.wall().delete().workflow());
        registeredWorkflows.put(
                ToolInput.DOOR_CREATE,
                        safeUseCases.door().primary().workflow());
        registeredWorkflows.put(
                ToolInput.DOOR_DELETE,
                        safeUseCases.door().delete().workflow());
        registeredWorkflows.put(
                ToolInput.CORRIDOR_CREATE,
                        safeUseCases.corridor().primary().pressAndHoverOnly());
        registeredWorkflows.put(
                ToolInput.CORRIDOR_DELETE,
                        safeUseCases.corridor().delete().pressAndHoverOnly());
        registeredWorkflows.put(
                ToolInput.STAIR_CREATE,
                safeUseCases.stairCreate().pressAndHoverOnly());
        registeredWorkflows.put(
                ToolInput.STAIR_CREATE_SQUARE,
                safeUseCases.stairCreateSquare().pressAndHoverOnly());
        registeredWorkflows.put(
                ToolInput.STAIR_CREATE_CIRCULAR,
                safeUseCases.stairCreateCircular().pressAndHoverOnly());
        registeredWorkflows.put(
                ToolInput.STAIR_DELETE,
                safeUseCases.stairDelete().pressOnly());
        registeredWorkflows.put(
                ToolInput.TRANSITION_CREATE,
                safeUseCases.transitionCreate().pressOnly());
        registeredWorkflows.put(
                ToolInput.TRANSITION_DELETE,
                safeUseCases.transitionDelete().pressOnly());
        registeredWorkflows.put(
                ToolInput.FEATURE_POI_CREATE,
                safeUseCases.featurePoiCreate().pressOnly());
        registeredWorkflows.put(
                ToolInput.FEATURE_OBJECT_CREATE,
                safeUseCases.featureObjectCreate().pressOnly());
        registeredWorkflows.put(
                ToolInput.FEATURE_ENCOUNTER_CREATE,
                safeUseCases.featureEncounterCreate().pressOnly());
        registeredWorkflows.put(
                ToolInput.FEATURE_DELETE,
                safeUseCases.featureDelete().pressOnly());
        workflows = Map.copyOf(registeredWorkflows);
    }

    public void apply(ToolWorkflowInput input) {
        ToolWorkflowInput safeInput = Objects.requireNonNull(input, "input");
        switch (safeInput.action()) {
            case START -> press(safeInput.tool(), safeInput.mainViewInput());
            case CONTINUE -> drag(safeInput.tool(), safeInput.mainViewInput());
            case FINISH -> release(safeInput.tool(), safeInput.mainViewInput());
            case PREVIEW -> hover(safeInput.tool(), safeInput.mainViewInput());
            case IGNORED -> {
            }
        }
    }

    private void press(ToolInput tool, MainViewInput input) {
        ToolWorkflow workflow = workflowFor(tool);
        if (workflow != null) {
            workflow.applyAction(workflow.pressed(), input);
        }
    }

    private void drag(ToolInput tool, MainViewInput input) {
        ToolWorkflow workflow = workflowFor(tool);
        if (workflow != null) {
            workflow.applyAction(workflow.dragged(), input);
        }
    }

    private void release(ToolInput tool, MainViewInput input) {
        ToolWorkflow workflow = workflowFor(tool);
        if (workflow != null) {
            workflow.applyAction(workflow.released(), input);
        }
    }

    private void hover(ToolInput tool, MainViewInput input) {
        ToolWorkflow workflow = workflowFor(tool);
        if (workflow != null) {
            workflow.applyAction(workflow.moved(), input);
        }
    }

    private ToolWorkflow workflowFor(ToolInput tool) {
        return workflows.get(Objects.requireNonNull(tool, "tool"));
    }

    public enum ToolInput {
        SELECT,
        ROOM_PAINT,
        ROOM_DELETE,
        WALL_CREATE,
        WALL_DELETE,
        DOOR_CREATE,
        DOOR_DELETE,
        CORRIDOR_CREATE,
        CORRIDOR_DELETE,
        STAIR_CREATE,
        STAIR_CREATE_SQUARE,
        STAIR_CREATE_CIRCULAR,
        STAIR_DELETE,
        TRANSITION_CREATE,
        TRANSITION_DELETE,
        FEATURE_POI_CREATE,
        FEATURE_OBJECT_CREATE,
        FEATURE_ENCOUNTER_CREATE,
        FEATURE_DELETE,
        UNSUPPORTED;

        public static ToolInput fromName(String name) {
            for (ToolInput input : values()) {
                if (input.name().equals(name)) {
                    return input;
                }
            }
            return UNSUPPORTED;
        }
    }

    public enum WorkflowAction {
        START,
        CONTINUE,
        FINISH,
        PREVIEW,
        IGNORED
    }

    public record ToolWorkflowInput(
            ToolInput tool,
            WorkflowAction action,
            MainViewInput mainViewInput
    ) {
        public ToolWorkflowInput {
            tool = Objects.requireNonNull(tool, "tool");
            action = Objects.requireNonNull(action, "action");
            mainViewInput = Objects.requireNonNull(mainViewInput, "mainViewInput");
        }
    }

    @FunctionalInterface
    public interface PointerAction {
        void apply(MainViewInput input);
    }

    private record ToolWorkflow(
            @Nullable PointerAction pressed,
            @Nullable PointerAction dragged,
            @Nullable PointerAction released,
            @Nullable PointerAction moved
    ) {
        private void applyAction(@Nullable PointerAction action, MainViewInput input) {
            if (action != null) {
                action.apply(input);
            }
        }
    }

    public record ToolWorkflowUseCases(
            PointerToolUseCase selection,
            PairedToolUseCases room,
            PairedToolUseCases wall,
            PairedToolUseCases door,
            PairedToolUseCases corridor,
            PointerToolUseCase stairCreate,
            PointerToolUseCase stairCreateSquare,
            PointerToolUseCase stairCreateCircular,
            PointerToolUseCase stairDelete,
            PointerToolUseCase transitionCreate,
            PointerToolUseCase transitionDelete,
            PointerToolUseCase featurePoiCreate,
            PointerToolUseCase featureObjectCreate,
            PointerToolUseCase featureEncounterCreate,
            PointerToolUseCase featureDelete
    ) {
        public ToolWorkflowUseCases {
            selection = Objects.requireNonNull(selection, "selection");
            room = Objects.requireNonNull(room, "room");
            wall = Objects.requireNonNull(wall, "wall");
            door = Objects.requireNonNull(door, "door");
            corridor = Objects.requireNonNull(corridor, "corridor");
            stairCreate = Objects.requireNonNull(stairCreate, "stairCreate");
            stairCreateSquare = Objects.requireNonNull(stairCreateSquare, "stairCreateSquare");
            stairCreateCircular = Objects.requireNonNull(stairCreateCircular, "stairCreateCircular");
            stairDelete = Objects.requireNonNull(stairDelete, "stairDelete");
            transitionCreate = Objects.requireNonNull(transitionCreate, "transitionCreate");
            transitionDelete = Objects.requireNonNull(transitionDelete, "transitionDelete");
            featurePoiCreate = Objects.requireNonNull(featurePoiCreate, "featurePoiCreate");
            featureObjectCreate = Objects.requireNonNull(featureObjectCreate, "featureObjectCreate");
            featureEncounterCreate = Objects.requireNonNull(featureEncounterCreate, "featureEncounterCreate");
            featureDelete = Objects.requireNonNull(featureDelete, "featureDelete");
        }
    }

    public record PointerToolUseCase(
            @Nullable PointerAction press,
            @Nullable PointerAction drag,
            @Nullable PointerAction release,
            @Nullable PointerAction hover
    ) {
        ToolWorkflow workflow() {
            return new ToolWorkflow(press, drag, release, hover);
        }

        ToolWorkflow withoutHover() {
            return new ToolWorkflow(press, drag, release, null);
        }

        ToolWorkflow pressAndHoverOnly() {
            return new ToolWorkflow(press, null, null, hover);
        }

        ToolWorkflow pressOnly() {
            return new ToolWorkflow(press, null, null, null);
        }
    }

    public record PairedToolUseCases(
            PointerToolUseCase primary,
            PointerToolUseCase delete
    ) {
        public PairedToolUseCases {
            primary = Objects.requireNonNull(primary, "primary");
            delete = Objects.requireNonNull(delete, "delete");
        }
    }
}
