package features.dungeon.adapter.javafx.map;

import java.util.List;
import features.dungeon.api.DungeonEditorHandleSnapshot;
import features.dungeon.api.DungeonEditorMapSnapshot;
import features.dungeon.api.DungeonEditorPreview;
import features.dungeon.api.DungeonEditorStateSnapshot;

final class DungeonMapEditorHandleProjector {

    private DungeonMapEditorHandleProjector() {
    }

    static void addHandles(
            List<DungeonMapRenderState.Marker> markers,
            DungeonEditorMapSnapshot map,
            DungeonEditorStateSnapshot.Selection selection,
            DungeonEditorPreview preview
    ) {
        for (DungeonEditorHandleSnapshot handle : map.editorHandles()) {
            if (!visibleHandle(handle, selection) || movingPreviewHandle(handle, preview)) {
                continue;
            }
            markers.add(DungeonMapRenderMarkers.handleMarker(handle, selection, false));
        }
    }

    private static boolean movingPreviewHandle(
            DungeonEditorHandleSnapshot handle,
            DungeonEditorPreview preview
    ) {
        return preview instanceof DungeonEditorPreview.MoveHandlePreview move
                && sameHandleIdentity(move.handleRef(), handle.ref());
    }

    private static boolean sameHandleIdentity(
            features.dungeon.api.DungeonEditorHandleRef first,
            features.dungeon.api.DungeonEditorHandleRef second
    ) {
        return first.kind() == second.kind()
                && first.topologyRef().equals(second.topologyRef())
                && first.ownerId() == second.ownerId()
                && first.clusterId() == second.clusterId()
                && first.corridorId() == second.corridorId()
                && first.roomId() == second.roomId()
                && first.index() == second.index();
    }

    private static boolean visibleHandle(
            DungeonEditorHandleSnapshot handle,
            DungeonEditorStateSnapshot.Selection selection
    ) {
        var ref = handle.ref();
        if (ref.kind().isClusterLabel() || ref.kind().isCorridorGeometryHandle()) {
            return false;
        }
        return ref.kind().isDoor()
                || !ref.kind().isClusterDragHandle()
                || selection != null
                && selection.clusterSelection()
                && selection.clusterId() == ref.clusterId();
    }
}
