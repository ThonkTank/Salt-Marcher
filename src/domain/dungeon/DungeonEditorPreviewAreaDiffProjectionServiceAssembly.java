package src.domain.dungeon;

import src.domain.dungeon.published.DungeonEditorMapSnapshot;

final class DungeonEditorPreviewAreaDiffProjectionServiceAssembly {

    private DungeonEditorPreviewAreaDiffProjectionServiceAssembly() {
    }

    static DungeonEditorPreviewFactDiffProjectionServiceAssembly<DungeonEditorMapSnapshot.Area> diff(
            DungeonEditorMapSnapshot committedMap,
            DungeonEditorMapSnapshot previewMap
    ) {
        return DungeonEditorPreviewDiffValuesProjectionServiceAssembly.diff(
                committedMap.areas(),
                previewMap.areas(),
                DungeonEditorPreviewAreaDiffProjectionServiceAssembly::key);
    }

    private static AreaKey key(DungeonEditorMapSnapshot.Area area) {
        return new AreaKey(area.kind(), area.id());
    }

    private record AreaKey(String kind, long id) {
    }
}
