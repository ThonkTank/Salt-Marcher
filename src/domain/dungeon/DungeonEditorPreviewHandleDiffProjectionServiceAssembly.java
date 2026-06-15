package src.domain.dungeon;

import src.domain.dungeon.published.DungeonEditorHandleRef;
import src.domain.dungeon.published.DungeonEditorHandleKind;
import src.domain.dungeon.published.DungeonEditorHandleSnapshot;
import src.domain.dungeon.published.DungeonEditorMapSnapshot;
import src.domain.dungeon.published.DungeonTopologyElementRef;
import src.domain.dungeon.published.DungeonTopologyElementKind;

final class DungeonEditorPreviewHandleDiffProjectionServiceAssembly {

    private DungeonEditorPreviewHandleDiffProjectionServiceAssembly() {
    }

    static DungeonEditorPreviewFactDiffProjectionServiceAssembly<DungeonEditorHandleSnapshot> diff(
            DungeonEditorMapSnapshot committedMap,
            DungeonEditorMapSnapshot previewMap
    ) {
        return DungeonEditorPreviewDiffValuesProjectionServiceAssembly.diff(
                committedMap.editorHandles(),
                previewMap.editorHandles(),
                DungeonEditorPreviewHandleDiffProjectionServiceAssembly::key);
    }

    private static HandleKey key(DungeonEditorHandleSnapshot handle) {
        DungeonEditorHandleRef handleRef = handle.ref();
        DungeonTopologyElementRef topologyRef = handleRef.topologyRef();
        return new HandleKey(
                handleRef.kind(),
                topologyRef.kind(),
                topologyRef.id(),
                handleRef.ownerId(),
                handleRef.clusterId(),
                handleRef.corridorId(),
                handleRef.roomId(),
                handleRef.index());
    }

    private record HandleKey(
            DungeonEditorHandleKind kind,
            DungeonTopologyElementKind topologyKind,
            long topologyId,
            long ownerId,
            long clusterId,
            long corridorId,
            long roomId,
            int index
    ) {
    }
}
