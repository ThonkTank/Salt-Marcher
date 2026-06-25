package src.features.dungeon.runtime;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.graph.DungeonTopologyElementKind;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorHandleType;
import src.domain.dungeon.published.DungeonEditorTool;

final class DungeonEditorRuntimeEnumTranslator {

    private DungeonEditorRuntimeEnumTranslator() {
    }

    static String toolName(String value) {
        return DungeonEditorRuntimeWorkflowMapping.toolName(value);
    }

    static String viewModeName(String value) {
        return "GRAPH".equals(normalizedEnumName(value)) ? "GRAPH" : "GRID";
    }

    static @Nullable DungeonEditorTool editorTool(String value) {
        return DungeonEditorRuntimeWorkflowMapping.toolFromKey(value);
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
        return DungeonEditorRuntimeWorkflowMapping.normalizedEnumName(value);
    }
}
