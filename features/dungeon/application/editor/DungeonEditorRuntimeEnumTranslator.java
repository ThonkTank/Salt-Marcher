package features.dungeon.application.editor;

import features.dungeon.application.editor.interaction.DungeonEditorHandleType;

final class DungeonEditorRuntimeEnumTranslator {
    private DungeonEditorRuntimeEnumTranslator() {
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
