package src.view.slotcontent.main.dungeonmap;

import java.util.List;
import src.domain.dungeon.published.DungeonEditorHandleSnapshot;
import src.domain.dungeon.published.DungeonEditorMapSnapshot;
import src.domain.dungeon.published.DungeonEditorStateSnapshot;
import src.features.dungeon.runtime.DungeonEditorMarkerHitRefs;

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
