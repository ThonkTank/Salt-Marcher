package src.features.dungeon.runtime;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import src.domain.dungeon.published.DungeonEditorHandleRef;
import src.domain.dungeon.published.DungeonEditorHandleSnapshot;
import src.domain.dungeon.published.DungeonEditorMapSnapshot;
import src.domain.dungeon.published.DungeonEditorMapSurfaceSnapshot;
import src.domain.dungeon.published.DungeonEditorPreview;
import src.domain.dungeon.published.DungeonEditorStateSnapshot;
import src.features.dungeon.runtime.DungeonEditorPreparedFrameFacts.PreviewHandleDiffFrame;

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

    static List<String> previewHandleHitRefs(
            DungeonEditorMapSurfaceSnapshot snapshot,
            DungeonEditorStateSnapshot.Selection selection
    ) {
        var previewDiff = DungeonEditorPreviewRenderDiffAssembler.from(snapshot);
        if (previewDiff.isEmpty()) {
            return List.of();
        }
        Set<String> hitRefs = new LinkedHashSet<>();
        addPreviewHandleHitRefs(hitRefs, previewDiff.changedHandles(), selection, snapshot);
        addPreviewHandleHitRefs(hitRefs, previewDiff.removedHandles(), selection, snapshot);
        return List.copyOf(hitRefs);
    }

    private static void addPreviewHandleHitRefs(
            Set<String> hitRefs,
            List<PreviewHandleDiffFrame> handles,
            DungeonEditorStateSnapshot.Selection selection,
            DungeonEditorMapSurfaceSnapshot snapshot
    ) {
        for (PreviewHandleDiffFrame handle : handles) {
            if (!visibleCanvasHandle(handle.ref(), selection)
                    || !DungeonEditorProjectionLevelInclusion.includes(snapshot, handle.cell().level())) {
                continue;
            }
            String hitRef = DungeonEditorMarkerHitRefs.marker(handle.ref(), handle.cell()).value();
            if (!hitRef.isBlank()) {
                hitRefs.add(hitRef);
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
