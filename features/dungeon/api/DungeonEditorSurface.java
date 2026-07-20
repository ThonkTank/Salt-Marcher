package features.dungeon.api;

import org.jspecify.annotations.Nullable;

public record DungeonEditorSurface(
        String mapName,
        int revision,
        DungeonEditorMapSnapshot map,
        @Nullable DungeonEditorMapSnapshot previewMap,
        @Nullable DungeonInspectorSnapshot inspector
) {

    public DungeonEditorSurface {
        mapName = mapName == null || mapName.isBlank() ? "Dungeon" : mapName.trim();
        revision = Math.max(0, revision);
        map = map == null ? DungeonEditorMapSnapshot.empty() : map;
    }
}
