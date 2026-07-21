package features.dungeon.application.editor;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import features.dungeon.api.DungeonEditorHandleRef;
import features.dungeon.api.DungeonEditorHandleSnapshot;
import features.dungeon.api.DungeonEditorMapSnapshot;
import features.dungeon.api.DungeonEditorPreview;

final class DungeonEditorHandlePointerTargets {
    private DungeonEditorHandlePointerTargets() {
    }

    static void addTargets(
            Map<String, features.dungeon.api.editor.DungeonEditorPointerInput.Target> targets,
            DungeonEditorMapSnapshot map,
            features.dungeon.api.editor.DungeonEditorSelection selection,
            DungeonEditorPreview preview,
            DungeonEditorSurfaceProjection snapshot
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
                targets.put(hitRef, features.dungeon.api.editor.DungeonEditorPointerInput.Target.handle(ref));
            }
        }
    }

    private static boolean visibleCanvasHandle(
            DungeonEditorHandleRef ref,
            features.dungeon.api.editor.DungeonEditorSelection selection
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
