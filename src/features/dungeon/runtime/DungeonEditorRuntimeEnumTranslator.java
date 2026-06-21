package src.features.dungeon.runtime;

import java.util.Locale;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.graph.DungeonTopologyElementKind;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorHandleType;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues;
import src.domain.dungeon.published.DungeonEditorTool;
import src.features.dungeon.runtime.ApplyDungeonEditorToolWorkflowUseCase.ToolInput;
import src.features.dungeon.runtime.ApplyDungeonEditorToolWorkflowUseCase.WorkflowAction;
import src.features.dungeon.runtime.DungeonEditorRuntimeOperations.PointerAction;

final class DungeonEditorRuntimeEnumTranslator {

    private DungeonEditorRuntimeEnumTranslator() {
    }

    static String toolName(String value) {
        DungeonEditorTool tool = editorTool(value);
        return tool == null ? DungeonEditorTool.SELECT.name() : tool.name();
    }

    static String viewModeName(String value) {
        return "GRAPH".equals(normalizedEnumName(value)) ? "GRAPH" : "GRID";
    }

    static ToolInput tool(String value) {
        return ToolInput.fromName(normalizedEnumName(value));
    }

    static @Nullable DungeonEditorTool editorTool(String value) {
        try {
            return DungeonEditorTool.valueOf(normalizedEnumName(value));
        } catch (IllegalArgumentException ignored) {
            return null;
        }
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

    static DungeonEditorWorkspaceValues.BoundaryKind boundaryKind(String value) {
        try {
            return DungeonEditorWorkspaceValues.BoundaryKind.fromExternalKind(normalizedEnumName(value));
        } catch (IllegalArgumentException ignored) {
            return DungeonEditorWorkspaceValues.BoundaryKind.WALL;
        }
    }

    static String labelKind(String value) {
        String normalized = normalizedEnumName(value);
        return normalized.isBlank() ? "EMPTY" : normalized;
    }

    static DungeonEditorHandleType handleType(String value) {
        try {
            return DungeonEditorHandleType.valueOf(normalizedEnumName(value));
        } catch (IllegalArgumentException ignored) {
            return DungeonEditorHandleType.CLUSTER_LABEL;
        }
    }

    static DungeonTopologyElementKind topologyKind(String value) {
        try {
            return DungeonTopologyElementKind.valueOf(normalizedEnumName(value));
        } catch (IllegalArgumentException ignored) {
            return DungeonTopologyElementKind.EMPTY;
        }
    }

    static String normalizedEnumName(String value) {
        return value == null ? "" : value.trim().toUpperCase(Locale.ROOT).replace('-', '_');
    }
}
