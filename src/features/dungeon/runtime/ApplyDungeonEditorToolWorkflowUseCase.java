package src.features.dungeon.runtime;

import java.util.EnumMap;
import java.util.Map;
import java.util.Objects;
import org.jspecify.annotations.Nullable;

final class ApplyDungeonEditorToolWorkflowUseCase {

    private final Map<ToolInput, ToolWorkflow> workflows;

    ApplyDungeonEditorToolWorkflowUseCase(ToolWorkflowUseCases useCases) {
        Map<ToolInput, ToolWorkflow> registeredWorkflows = new EnumMap<>(ToolInput.class);
        ToolWorkflowUseCases safeUseCases = Objects.requireNonNull(useCases, "useCases");
        registeredWorkflows.put(
                ToolInput.ROOM_PAINT,
                        safeUseCases.room().primary().withoutHover());
        registeredWorkflows.put(
                ToolInput.ROOM_DELETE,
                        safeUseCases.room().delete().withoutHover());
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

    void apply(ToolWorkflowInput input) {
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

    private void press(ToolInput tool, DungeonEditorMainViewInput input) {
        ToolWorkflow workflow = workflowFor(tool);
        if (workflow != null) {
            workflow.applyAction(workflow.pressed(), input);
        }
    }

    private void drag(ToolInput tool, DungeonEditorMainViewInput input) {
        ToolWorkflow workflow = workflowFor(tool);
        if (workflow != null) {
            workflow.applyAction(workflow.dragged(), input);
        }
    }

    private void release(ToolInput tool, DungeonEditorMainViewInput input) {
        ToolWorkflow workflow = workflowFor(tool);
        if (workflow != null) {
            workflow.applyAction(workflow.released(), input);
        }
    }

    private void hover(ToolInput tool, DungeonEditorMainViewInput input) {
        ToolWorkflow workflow = workflowFor(tool);
        if (workflow != null) {
            workflow.applyAction(workflow.moved(), input);
        }
    }

    private ToolWorkflow workflowFor(ToolInput tool) {
        return workflows.get(Objects.requireNonNull(tool, "tool"));
    }

    enum ToolInput {
        ROOM_PAINT,
        ROOM_DELETE,
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

        static ToolInput fromName(String name) {
            for (ToolInput input : values()) {
                if (input.name().equals(name)) {
                    return input;
                }
            }
            return UNSUPPORTED;
        }
    }

    enum WorkflowAction {
        START,
        CONTINUE,
        FINISH,
        PREVIEW,
        IGNORED
    }

    record ToolWorkflowInput(
            ToolInput tool,
            WorkflowAction action,
            DungeonEditorMainViewInput mainViewInput
    ) {
        ToolWorkflowInput {
            tool = Objects.requireNonNull(tool, "tool");
            action = Objects.requireNonNull(action, "action");
            mainViewInput = Objects.requireNonNull(mainViewInput, "mainViewInput");
        }
    }

    @FunctionalInterface
    interface PointerAction {
        void apply(DungeonEditorMainViewInput input);
    }

    private record ToolWorkflow(
            @Nullable PointerAction pressed,
            @Nullable PointerAction dragged,
            @Nullable PointerAction released,
            @Nullable PointerAction moved
    ) {
        private void applyAction(@Nullable PointerAction action, DungeonEditorMainViewInput input) {
            if (action != null) {
                action.apply(input);
            }
        }
    }

    record ToolWorkflowUseCases(
            PairedToolUseCases room,
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
        ToolWorkflowUseCases {
            room = Objects.requireNonNull(room, "room");
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

    record PointerToolUseCase(
            @Nullable PointerAction press,
            @Nullable PointerAction drag,
            @Nullable PointerAction release,
            @Nullable PointerAction hover
    ) {
        ToolWorkflow withoutHover() {
            return new ToolWorkflow(press, drag, release, null);
        }

        ToolWorkflow pressOnly() {
            return new ToolWorkflow(press, null, null, null);
        }
    }

    record PairedToolUseCases(
            PointerToolUseCase primary,
            PointerToolUseCase delete
    ) {
        PairedToolUseCases {
            primary = Objects.requireNonNull(primary, "primary");
            delete = Objects.requireNonNull(delete, "delete");
        }
    }
}
