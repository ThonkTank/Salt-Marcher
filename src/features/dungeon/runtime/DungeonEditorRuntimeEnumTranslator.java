package src.features.dungeon.runtime;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorHandleType;
import src.domain.dungeon.published.DungeonEditorTool;

final class DungeonEditorRuntimeEnumTranslator {
    private static final DungeonEditorToolRegistry TOOL_REGISTRY = DungeonEditorToolRegistry.current();

    private DungeonEditorRuntimeEnumTranslator() {
    }

    static String toolName(String value) {
        return TOOL_REGISTRY.toolName(value);
    }

    static String viewModeName(String value) {
        return "GRAPH".equals(normalizedEnumName(value)) ? "GRAPH" : "GRID";
    }

    static @Nullable DungeonEditorTool editorTool(String value) {
        return TOOL_REGISTRY.toolFromKey(value);
    }

    static DungeonEditorHandleType handleType(String value) {
        try {
            return DungeonEditorHandleType.valueOf(normalizedEnumName(value));
        } catch (IllegalArgumentException ignored) {
            return DungeonEditorHandleType.CLUSTER_LABEL;
        }
    }

    static String normalizedEnumName(String value) {
        return DungeonEditorToolRegistry.normalizedToolKey(value);
    }
}
