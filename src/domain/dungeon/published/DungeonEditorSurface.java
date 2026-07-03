package src.domain.dungeon.published;

import org.jspecify.annotations.Nullable;

public record DungeonEditorSurface(
        String mapName,
        int revision,
        DungeonEditorMapSnapshot map,
        @Nullable DungeonEditorMapSnapshot previewMap,
        DungeonEditorPreviewDiff previewDiff,
        @Nullable DungeonInspectorSnapshot inspector
) {

    public DungeonEditorSurface {
        mapName = mapName == null || mapName.isBlank() ? "Dungeon" : mapName.trim();
        revision = Math.max(0, revision);
        map = map == null ? DungeonEditorMapSnapshot.empty() : map;
        // LEGACY_REMOVE_ON_TOUCH: non-authoritative preview diff compatibility; remove when no published
        // surface consumers or harness assertions require DungeonEditorSurface.previewDiff().
        previewDiff = previewDiff == null ? DungeonEditorPreviewDiff.empty() : previewDiff;
    }
}
