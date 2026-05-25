package src.domain.dungeon.model.worldspace.usecase;

import java.util.EnumMap;
import java.util.Map;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.worldspace.usecase.BuildDungeonEditorMainViewInputUseCase.MainViewInput;

public final class ApplyDungeonEditorToolWorkflowUseCase {

    private final Map<ToolInput, ToolWorkflow> workflows;

    public ApplyDungeonEditorToolWorkflowUseCase(
            ApplyDungeonEditorSelectionUseCase applySelectionUseCase,
            ApplyDungeonEditorPaintRoomUseCase applyPaintRoomUseCase,
            ApplyDungeonEditorDeleteRoomUseCase applyDeleteRoomUseCase,
            ApplyDungeonEditorCreateWallUseCase applyCreateWallUseCase,
            ApplyDungeonEditorDeleteWallUseCase applyDeleteWallUseCase,
            ApplyDungeonEditorCreateDoorUseCase applyCreateDoorUseCase,
            ApplyDungeonEditorDeleteDoorUseCase applyDeleteDoorUseCase,
            ApplyDungeonEditorCreateCorridorUseCase applyCreateCorridorUseCase,
            ApplyDungeonEditorDeleteCorridorUseCase applyDeleteCorridorUseCase
    ) {
        Map<ToolInput, ToolWorkflow> registeredWorkflows = new EnumMap<>(ToolInput.class);
        registeredWorkflows.put(
                ToolInput.SELECT,
                new ToolWorkflow(
                        applySelectionUseCase::press,
                        applySelectionUseCase::drag,
                        applySelectionUseCase::release,
                        applySelectionUseCase::hover));
        registeredWorkflows.put(
                ToolInput.ROOM_PAINT,
                new ToolWorkflow(
                        applyPaintRoomUseCase::press,
                        applyPaintRoomUseCase::drag,
                        applyPaintRoomUseCase::release,
                        null));
        registeredWorkflows.put(
                ToolInput.ROOM_DELETE,
                new ToolWorkflow(
                        applyDeleteRoomUseCase::press,
                        applyDeleteRoomUseCase::drag,
                        applyDeleteRoomUseCase::release,
                        null));
        registeredWorkflows.put(
                ToolInput.WALL_CREATE,
                new ToolWorkflow(
                        applyCreateWallUseCase::press,
                        applyCreateWallUseCase::drag,
                        null,
                        applyCreateWallUseCase::hover));
        registeredWorkflows.put(
                ToolInput.WALL_DELETE,
                new ToolWorkflow(
                        applyDeleteWallUseCase::press,
                        applyDeleteWallUseCase::drag,
                        null,
                        applyDeleteWallUseCase::hover));
        registeredWorkflows.put(
                ToolInput.DOOR_CREATE,
                new ToolWorkflow(
                        applyCreateDoorUseCase::press,
                        applyCreateDoorUseCase::drag,
                        applyCreateDoorUseCase::release,
                        applyCreateDoorUseCase::hover));
        registeredWorkflows.put(
                ToolInput.DOOR_DELETE,
                new ToolWorkflow(
                        applyDeleteDoorUseCase::press,
                        applyDeleteDoorUseCase::drag,
                        applyDeleteDoorUseCase::release,
                        applyDeleteDoorUseCase::hover));
        registeredWorkflows.put(
                ToolInput.CORRIDOR_CREATE,
                new ToolWorkflow(
                        applyCreateCorridorUseCase::press,
                        null,
                        null,
                        applyCreateCorridorUseCase::hover));
        registeredWorkflows.put(
                ToolInput.CORRIDOR_DELETE,
                new ToolWorkflow(
                        applyDeleteCorridorUseCase::press,
                        null,
                        null,
                        applyDeleteCorridorUseCase::hover));
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
    private interface PointerAction {
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
}
