package features.dungeon.application.editor;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import features.dungeon.api.DungeonEditorHandleRef;
import features.dungeon.api.DungeonEditorHandleSnapshot;
import features.dungeon.api.DungeonEditorMapSnapshot;
import features.dungeon.api.DungeonEditorMapSurfaceSnapshot;
import features.dungeon.api.DungeonEditorPreview;
import features.dungeon.api.DungeonEditorStateSnapshot;

final class DungeonEditorHandlePointerTargets {
    private DungeonEditorHandlePointerTargets() {
    }

    static void addTargets(
            Map<String, DungeonEditorRuntimePointerTarget> targets,
            DungeonEditorMapSnapshot map,
            DungeonEditorStateSnapshot.Selection selection,
            DungeonEditorPreview preview,
            DungeonEditorMapSurfaceSnapshot snapshot
    ) {
        for (DungeonEditorHandleSnapshot handle : map.editorHandles()) {
            DungeonEditorHandleRef ref = handle.ref();
            if (!visibleCanvasHandle(ref, selection)
                    || movingPreviewHandle(ref, preview)
                    || !DungeonEditorProjectionLevelInclusion.includes(snapshot, handle.cell().level())) {
                continue;
            }
            String hitRef = DungeonEditorMarkerHitRefs.marker(ref, handle.cell()).value();
            if (!hitRef.isBlank()) {
                targets.put(hitRef, DungeonEditorRuntimePointerTarget.handle(ref));
            }
        }
    }

    private static boolean visibleCanvasHandle(
            DungeonEditorHandleRef ref,
            DungeonEditorStateSnapshot.Selection selection
    ) {
        if (ref.kind().isClusterLabel() || ref.kind().isCorridorGeometryHandle()) {
            return false;
        }
        if (ref.kind().isDoor()) {
            return true;
        }
        return !ref.kind().isClusterDragHandle()
                || selection != null
                && selection.clusterSelection()
                && selection.clusterId() == ref.clusterId();
    }

    private static boolean movingPreviewHandle(DungeonEditorHandleRef ref, DungeonEditorPreview preview) {
        return preview instanceof DungeonEditorPreview.MoveHandlePreview handlePreview
                && sameHandleRef(ref, handlePreview.handleRef());
    }

    private static boolean sameHandleRef(DungeonEditorHandleRef first, DungeonEditorHandleRef second) {
        return first != null
                && second != null
                && first.kind() == second.kind()
                && Objects.equals(first.topologyRef(), second.topologyRef())
                && first.ownerId() == second.ownerId()
                && first.clusterId() == second.clusterId()
                && first.corridorId() == second.corridorId()
                && first.roomId() == second.roomId()
                && first.index() == second.index();
    }
}
