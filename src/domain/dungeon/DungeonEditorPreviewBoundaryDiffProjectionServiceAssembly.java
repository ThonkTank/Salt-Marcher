package src.domain.dungeon;

import src.domain.dungeon.published.DungeonEditorMapSnapshot;
import src.domain.dungeon.published.DungeonEditorTopologyElementRef;

final class DungeonEditorPreviewBoundaryDiffProjectionServiceAssembly {

    private DungeonEditorPreviewBoundaryDiffProjectionServiceAssembly() {
    }

    static DungeonEditorPreviewFactDiffProjectionServiceAssembly<DungeonEditorMapSnapshot.Boundary> diff(
            DungeonEditorMapSnapshot committedMap,
            DungeonEditorMapSnapshot previewMap
    ) {
        return DungeonEditorPreviewDiffValuesProjectionServiceAssembly.diff(
                committedMap.boundaries(),
                previewMap.boundaries(),
                DungeonEditorPreviewBoundaryDiffProjectionServiceAssembly::key);
    }

    private static BoundaryKey key(DungeonEditorMapSnapshot.Boundary boundary) {
        DungeonEditorTopologyElementRef ref = boundary.topologyRef();
        return new BoundaryKey(ref.kind(), ref.id(), boundary.id());
    }

    private record BoundaryKey(String topologyKind, long topologyId, long boundaryId) {
    }
}
