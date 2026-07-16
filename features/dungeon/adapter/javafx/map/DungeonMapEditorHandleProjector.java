package features.dungeon.adapter.javafx.map;

import java.util.List;
import features.dungeon.api.DungeonEditorHandleSnapshot;
import features.dungeon.api.DungeonEditorMapSnapshot;
import features.dungeon.api.DungeonEditorStateSnapshot;
import features.dungeon.application.editor.DungeonEditorMarkerHitRefs;

final class DungeonMapEditorHandleProjector {

    private DungeonMapEditorHandleProjector() {
    }

    static void addHandles(
            List<DungeonMapRenderState.Marker> markers,
            DungeonEditorMapSnapshot map,
            DungeonEditorStateSnapshot.Selection selection,
            DungeonMapContentModel.MapInteractionFrame interactionFrame
    ) {
        for (DungeonEditorHandleSnapshot handle : map.editorHandles()) {
            if (!runtimePreparedHandle(handle, interactionFrame)) {
                continue;
            }
            markers.add(DungeonMapRenderMarkers.handleMarker(handle, selection, false));
        }
    }

    private static boolean runtimePreparedHandle(
            DungeonEditorHandleSnapshot handle,
            DungeonMapContentModel.MapInteractionFrame interactionFrame
    ) {
        String hitRef = DungeonEditorMarkerHitRefs.marker(handle.ref(), handle.cell()).value();
        if (hitRef.isBlank()) {
            return false;
        }
        DungeonMapContentModel.PointerTarget target = interactionFrame.pointerTargets().get(hitRef);
        return target != null
                && target.isHandleTarget()
                && DungeonMapRenderSelection.sameHandleRef(handle.ref(), target.handleRef());
    }
}
