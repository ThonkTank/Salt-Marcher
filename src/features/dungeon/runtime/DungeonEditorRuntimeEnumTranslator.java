package src.features.dungeon.runtime;

import java.util.Locale;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorToolWorkflowUseCase.ToolInput;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorToolWorkflowUseCase.WorkflowAction;
import src.domain.dungeon.model.runtime.usecase.BuildDungeonEditorMainViewInputUseCase.BoundaryKindInput;
import src.domain.dungeon.model.runtime.usecase.BuildDungeonEditorMainViewInputUseCase.HandleKindInput;
import src.domain.dungeon.model.runtime.usecase.BuildDungeonEditorMainViewInputUseCase.LabelKindInput;
import src.domain.dungeon.model.runtime.usecase.BuildDungeonEditorMainViewInputUseCase.TopologyKindInput;
import src.features.dungeon.runtime.DungeonEditorRuntimeOperations.PointerAction;

final class DungeonEditorRuntimeEnumTranslator {

    private DungeonEditorRuntimeEnumTranslator() {
    }

    static String toolName(String value) {
        ToolInput input = tool(value);
        return input == ToolInput.UNSUPPORTED ? ToolInput.SELECT.name() : input.name();
    }

    static String viewModeName(String value) {
        return "GRAPH".equals(normalizedEnumName(value)) ? "GRAPH" : "GRID";
    }

    static ToolInput tool(String value) {
        return ToolInput.fromName(normalizedEnumName(value));
    }

    static WorkflowAction workflowAction(PointerAction action) {
        if (action == null) {
            return WorkflowAction.PREVIEW;
        }
        return switch (action) {
            case PRESSED -> WorkflowAction.START;
            case DRAGGED -> WorkflowAction.CONTINUE;
            case RELEASED -> WorkflowAction.FINISH;
            case MOVED -> WorkflowAction.PREVIEW;
        };
    }

    static BoundaryKindInput boundaryKind(String value) {
        try {
            return BoundaryKindInput.fromName(normalizedEnumName(value));
        } catch (IllegalArgumentException ignored) {
            return BoundaryKindInput.WALL;
        }
    }

    static HandleKindInput handleKind(String value) {
        try {
            return HandleKindInput.fromName(normalizedEnumName(value));
        } catch (IllegalArgumentException ignored) {
            return HandleKindInput.CLUSTER_LABEL;
        }
    }

    static LabelKindInput labelKind(String value) {
        try {
            return LabelKindInput.fromName(normalizedEnumName(value));
        } catch (IllegalArgumentException ignored) {
            return LabelKindInput.EMPTY;
        }
    }

    static TopologyKindInput topologyKind(String value) {
        try {
            return TopologyKindInput.fromName(normalizedEnumName(value));
        } catch (IllegalArgumentException ignored) {
            return TopologyKindInput.EMPTY;
        }
    }

    static String normalizedEnumName(String value) {
        return value == null ? "" : value.trim().toUpperCase(Locale.ROOT).replace('-', '_');
    }
}
