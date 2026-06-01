package src.domain.dungeon.model.worldspace.usecase;

import java.util.EnumMap;
import java.util.Map;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.worldspace.usecase.BuildDungeonEditorMainViewInputUseCase.MainViewInput;

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
                safeUseCases.stairCreate().pressOnly());
        registeredWorkflows.put(
                ToolInput.STAIR_CREATE_SQUARE,
                safeUseCases.stairCreateSquare().pressOnly());
        registeredWorkflows.put(
                ToolInput.STAIR_CREATE_CIRCULAR,
                safeUseCases.stairCreateCircular().pressOnly());
        registeredWorkflows.put(
                ToolInput.STAIR_DELETE,
                safeUseCases.stairDelete().pressOnly());
        registeredWorkflows.put(
                ToolInput.TRANSITION_CREATE,
                safeUseCases.transitionCreate().pressOnly());
        registeredWorkflows.put(
                ToolInput.TRANSITION_DELETE,
                safeUseCases.transitionDelete().pressOnly());
        workflows = Map.copyOf(registeredWorkflows);
    }

    public void apply(ToolInput tool, WorkflowAction action, MainViewInput input) {
        switch (Objects.requireNonNull(action, "action")) {
            case START -> press(tool, input);
            case CONTINUE -> drag(tool, input);
            case FINISH -> release(tool, input);
            case PREVIEW -> hover(tool, input);
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
            PointerToolUseCase transitionDelete
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
