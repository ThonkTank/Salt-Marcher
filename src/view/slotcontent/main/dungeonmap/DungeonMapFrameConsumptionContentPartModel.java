package src.view.slotcontent.main.dungeonmap;

import java.util.Map;
import java.util.Objects;
import src.domain.dungeon.published.DungeonEditorMapSurfaceSnapshot;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.MapInteractionFrame;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.PointerTarget;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.PointerTargetKind;

final class DungeonMapFrameConsumptionContentPartModel {
    private DungeonEditorMapSurfaceSnapshot currentEditorSurfaceSnapshot = DungeonEditorMapSurfaceSnapshot.empty();
    private MapInteractionFrame currentMapInteractionFrame = MapInteractionFrame.empty();
    private boolean editorSurfaceSnapshotCurrent;
    private PointerTarget currentHoverTarget = PointerTarget.empty();
    private Map<String, PointerTarget> pointerTargets = Map.of();

    EditorSurfaceFrame consumeEditorSurfaceFrame(
            DungeonEditorMapSurfaceSnapshot editorSnapshot,
            MapInteractionFrame interactionFrame
    ) {
        DungeonEditorMapSurfaceSnapshot safeSnapshot = editorSnapshot == null
                ? DungeonEditorMapSurfaceSnapshot.empty()
                : editorSnapshot;
        MapInteractionFrame safeFrame = interactionFrame == null ? MapInteractionFrame.empty() : interactionFrame;
        if (editorSurfaceSnapshotCurrent
                && safeSnapshot.equals(currentEditorSurfaceSnapshot)
                && safeFrame.equals(currentMapInteractionFrame)) {
            return EditorSurfaceFrame.unchanged(safeSnapshot, safeFrame);
        }
        currentEditorSurfaceSnapshot = safeSnapshot;
        currentMapInteractionFrame = safeFrame;
        editorSurfaceSnapshotCurrent = true;
        return EditorSurfaceFrame.changed(safeSnapshot, safeFrame);
    }

    MapInteractionFrame consumeTravelSnapshot() {
        editorSurfaceSnapshotCurrent = false;
        currentEditorSurfaceSnapshot = DungeonEditorMapSurfaceSnapshot.empty();
        currentMapInteractionFrame = MapInteractionFrame.empty();
        return currentMapInteractionFrame;
    }

    PointerTarget consumeRenderFrame(MapInteractionFrame interactionFrame) {
        MapInteractionFrame safeFrame = interactionFrame == null ? MapInteractionFrame.empty() : interactionFrame;
        pointerTargets = safeFrame.pointerTargets();
        currentHoverTarget = retainedHoverTarget(currentHoverTarget, pointerTargets);
        return currentHoverTarget;
    }

    Map<String, PointerTarget> currentPointerTargets() {
        return pointerTargets;
    }

    PointerTarget currentHoverTarget() {
        return currentHoverTarget;
    }

    boolean updateHoverTarget(PointerTarget target) {
        PointerTarget nextTarget = selectableHoverTarget(target);
        if (sameHoverTarget(nextTarget, currentHoverTarget)) {
            return false;
        }
        currentHoverTarget = nextTarget;
        return true;
    }

    boolean clearHoverTarget() {
        return updateHoverTarget(PointerTarget.empty());
    }

    static PointerTarget selectableHoverTarget(PointerTarget target) {
        PointerTarget safeTarget = target == null ? PointerTarget.empty() : target;
        if (safeTarget.targetKind() == PointerTargetKind.EMPTY || safeTarget.isRoomLabelTarget()) {
            return PointerTarget.empty();
        }
        return safeTarget;
    }

    private static PointerTarget retainedHoverTarget(
            PointerTarget target,
            Map<String, PointerTarget> availableTargets
    ) {
        PointerTarget safeTarget = selectableHoverTarget(target);
        if (safeTarget.targetKind() == PointerTargetKind.EMPTY) {
            return PointerTarget.empty();
        }
        for (PointerTarget availableTarget : availableTargets.values()) {
            if (sameHoverTarget(safeTarget, availableTarget)) {
                return selectableHoverTarget(availableTarget);
            }
        }
        return PointerTarget.empty();
    }

    private static boolean sameHoverTarget(PointerTarget first, PointerTarget second) {
        PointerTarget safeFirst = selectableHoverTarget(first);
        PointerTarget safeSecond = selectableHoverTarget(second);
        if (safeFirst.targetKind() != safeSecond.targetKind()) {
            return false;
        }
        if (safeFirst.targetKind() == PointerTargetKind.HANDLE) {
            return safeFirst.handleRef().equals(safeSecond.handleRef());
        }
        if (safeFirst.targetKind() == PointerTargetKind.BOUNDARY) {
            return safeFirst.ownerId() == safeSecond.ownerId()
                    && Objects.equals(safeFirst.topologyRef(), safeSecond.topologyRef());
        }
        if (safeFirst.targetKind() == PointerTargetKind.LABEL) {
            return safeFirst.labelKind().equals(safeSecond.labelKind())
                    && safeFirst.ownerId() == safeSecond.ownerId()
                    && safeFirst.clusterId() == safeSecond.clusterId()
                    && Objects.equals(safeFirst.topologyRef(), safeSecond.topologyRef());
        }
        if (safeFirst.targetKind() == PointerTargetKind.CELL
                || safeFirst.targetKind() == PointerTargetKind.GRAPH_NODE) {
            return safeFirst.elementKind().equals(safeSecond.elementKind())
                    && safeFirst.ownerId() == safeSecond.ownerId()
                    && safeFirst.clusterId() == safeSecond.clusterId()
                    && Objects.equals(safeFirst.topologyRef(), safeSecond.topologyRef());
        }
        return safeFirst.equals(safeSecond);
    }

    record EditorSurfaceFrame(
            boolean changed,
            DungeonEditorMapSurfaceSnapshot editorSnapshot,
            MapInteractionFrame interactionFrame
    ) {

        private static EditorSurfaceFrame changed(
                DungeonEditorMapSurfaceSnapshot editorSnapshot,
                MapInteractionFrame interactionFrame
        ) {
            return new EditorSurfaceFrame(true, editorSnapshot, interactionFrame);
        }

        private static EditorSurfaceFrame unchanged(
                DungeonEditorMapSurfaceSnapshot editorSnapshot,
                MapInteractionFrame interactionFrame
        ) {
            return new EditorSurfaceFrame(false, editorSnapshot, interactionFrame);
        }
    }
}
