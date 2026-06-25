package src.view.slotcontent.main.dungeonmap;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import src.domain.dungeon.published.DungeonEditorMapHitRef;
import src.domain.dungeon.published.DungeonEditorMapSurfaceSnapshot;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.CellTarget;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.MapInteractionFrame;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.PointerTarget;

final class DungeonMapFrameConsumptionContentPartModel {
    private DungeonEditorMapSurfaceSnapshot currentEditorSurfaceSnapshot = DungeonEditorMapSurfaceSnapshot.empty();
    private MapInteractionFrame currentMapInteractionFrame = MapInteractionFrame.empty();
    private boolean editorSurfaceSnapshotCurrent;
    private PointerTarget currentHoverTarget = PointerTarget.empty();
    private SyntheticHoverContext currentSurfaceContext = SyntheticHoverContext.empty();
    private SyntheticHoverContext currentHoverContext = SyntheticHoverContext.empty();
    private Map<String, PointerTarget> pointerTargets = Map.of();

    EditorSurfaceFrame consumeEditorSurfaceFrame(
            DungeonEditorMapSurfaceSnapshot editorSnapshot,
            MapInteractionFrame interactionFrame
    ) {
        DungeonEditorMapSurfaceSnapshot safeSnapshot = editorSnapshot == null
                ? DungeonEditorMapSurfaceSnapshot.empty()
                : editorSnapshot;
        MapInteractionFrame safeFrame = interactionFrame == null ? MapInteractionFrame.empty() : interactionFrame;
        SyntheticHoverContext nextSurfaceContext = SyntheticHoverContext.from(safeSnapshot);
        if (editorSurfaceSnapshotCurrent
                && safeSnapshot.equals(currentEditorSurfaceSnapshot)
                && safeFrame.equals(currentMapInteractionFrame)
                && nextSurfaceContext.equals(currentSurfaceContext)) {
            currentSurfaceContext = nextSurfaceContext;
            return EditorSurfaceFrame.unchanged(safeSnapshot, safeFrame);
        }
        currentEditorSurfaceSnapshot = safeSnapshot;
        currentMapInteractionFrame = safeFrame;
        currentSurfaceContext = nextSurfaceContext;
        editorSurfaceSnapshotCurrent = true;
        return EditorSurfaceFrame.changed(safeSnapshot, safeFrame);
    }

    MapInteractionFrame consumeTravelSnapshot() {
        editorSurfaceSnapshotCurrent = false;
        currentEditorSurfaceSnapshot = DungeonEditorMapSurfaceSnapshot.empty();
        currentMapInteractionFrame = MapInteractionFrame.empty();
        currentSurfaceContext = SyntheticHoverContext.empty();
        currentHoverContext = SyntheticHoverContext.empty();
        currentHoverTarget = PointerTarget.empty();
        return currentMapInteractionFrame;
    }

    PointerTarget consumeRenderFrame(MapInteractionFrame interactionFrame) {
        MapInteractionFrame safeFrame = interactionFrame == null ? MapInteractionFrame.empty() : interactionFrame;
        pointerTargets = withExactCellTargets(safeFrame.pointerTargets());
        currentHoverTarget = retainedHoverTarget(
                currentHoverTarget,
                pointerTargets,
                currentHoverContext,
                currentSurfaceContext);
        if (!currentHoverTarget.syntheticHoverTarget()) {
            currentHoverContext = SyntheticHoverContext.empty();
        }
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
        currentHoverContext = nextTarget.syntheticHoverTarget()
                ? currentSurfaceContext
                : SyntheticHoverContext.empty();
        return true;
    }

    boolean clearHoverTarget() {
        return updateHoverTarget(PointerTarget.empty());
    }

    static PointerTarget selectableHoverTarget(PointerTarget target) {
        PointerTarget safeTarget = target == null ? PointerTarget.empty() : target;
        if (safeTarget.isEmptyTarget() || safeTarget.isRoomLabelTarget()) {
            return PointerTarget.empty();
        }
        return safeTarget;
    }

    private static PointerTarget retainedHoverTarget(
            PointerTarget target,
            Map<String, PointerTarget> availableTargets,
            SyntheticHoverContext hoverContext,
            SyntheticHoverContext surfaceContext
    ) {
        PointerTarget safeTarget = selectableHoverTarget(target);
        if (safeTarget.isEmptyTarget()) {
            return PointerTarget.empty();
        }
        if (safeTarget.syntheticHoverTarget()) {
            return hoverContext.equals(surfaceContext) ? safeTarget : PointerTarget.empty();
        }
        for (PointerTarget availableTarget : availableTargets.values()) {
            if (sameHoverTarget(safeTarget, availableTarget)) {
                return selectableHoverTarget(availableTarget);
            }
        }
        return PointerTarget.empty();
    }

    private record SyntheticHoverContext(
            String viewMode,
            int projectionLevel
    ) {
        static SyntheticHoverContext empty() {
            return new SyntheticHoverContext("", 0);
        }

        static SyntheticHoverContext from(DungeonEditorMapSurfaceSnapshot snapshot) {
            DungeonEditorMapSurfaceSnapshot safeSnapshot = snapshot == null
                    ? DungeonEditorMapSurfaceSnapshot.empty()
                    : snapshot;
            return new SyntheticHoverContext(
                    safeSnapshot.viewMode().name(),
                    safeSnapshot.projectionLevel());
        }
    }

    private static boolean sameHoverTarget(PointerTarget first, PointerTarget second) {
        PointerTarget safeFirst = selectableHoverTarget(first);
        PointerTarget safeSecond = selectableHoverTarget(second);
        if (!safeFirst.targetKind().equals(safeSecond.targetKind())) {
            return false;
        }
        return switch (safeFirst.targetKind()) {
            case HANDLE -> safeFirst.handleRef().equals(safeSecond.handleRef());
            case BOUNDARY -> sameBoundaryTarget(safeFirst, safeSecond);
            case LABEL -> sameLabelTarget(safeFirst, safeSecond);
            case CELL -> sameCellTarget(safeFirst, safeSecond);
            case GRAPH_NODE -> sameCellOwner(safeFirst, safeSecond);
            case VERTEX -> sameVertexTarget(safeFirst, safeSecond);
            default -> safeFirst.equals(safeSecond);
        };
    }

    private static boolean sameLabelTarget(PointerTarget first, PointerTarget second) {
        return first.labelKind().equals(second.labelKind())
                && first.ownerId() == second.ownerId()
                && first.clusterId() == second.clusterId()
                && Objects.equals(first.topologyRef(), second.topologyRef());
    }

    private static boolean sameCellTarget(PointerTarget first, PointerTarget second) {
        if (exactCellAvailable(first, second)) {
            return sameCellOwner(first, second) && sameCellRef(first.cellRef(), second.cellRef());
        }
        return sameCellOwner(first, second);
    }

    private static boolean sameCellRef(CellTarget first, CellTarget second) {
        return first.q() == second.q()
                && first.r() == second.r()
                && first.level() == second.level();
    }

    private static boolean sameVertexTarget(PointerTarget first, PointerTarget second) {
        return first.vertexRef().q() == second.vertexRef().q()
                && first.vertexRef().r() == second.vertexRef().r()
                && first.vertexRef().level() == second.vertexRef().level();
    }

    private static boolean sameCellOwner(PointerTarget first, PointerTarget second) {
        return first.elementKind().equals(second.elementKind())
                && first.ownerId() == second.ownerId()
                && first.clusterId() == second.clusterId()
                && Objects.equals(first.topologyRef(), second.topologyRef());
    }

    private static Map<String, PointerTarget> withExactCellTargets(
            Map<String, PointerTarget> targets
    ) {
        if (targets == null || targets.isEmpty()) {
            return Map.of();
        }
        Map<String, PointerTarget> exactTargets = new LinkedHashMap<>();
        for (Map.Entry<String, PointerTarget> entry : targets.entrySet()) {
            PointerTarget target = entry.getValue() == null ? PointerTarget.empty() : entry.getValue();
            exactTargets.put(entry.getKey(), target.withCellRef(cellTarget(entry.getKey(), target)));
        }
        return Map.copyOf(exactTargets);
    }

    private static CellTarget cellTarget(String hitRef, PointerTarget target) {
        if (target == null || !target.isCellTarget() || hitRef == null) {
            return CellTarget.empty();
        }
        DungeonEditorMapHitRef.ExactCellHitRef exactCell = DungeonEditorMapHitRef.parseExactCell(hitRef);
        if (!exactCell.exact()) {
            return CellTarget.empty();
        }
        return new CellTarget(exactCell.key(), exactCell.q(), exactCell.r(), exactCell.level());
    }

    private static boolean exactCellAvailable(PointerTarget first, PointerTarget second) {
        return first.cellRef().exact() && second.cellRef().exact();
    }

    private static boolean sameBoundaryTarget(PointerTarget first, PointerTarget second) {
        boolean sameOwner = first.ownerId() == second.ownerId()
                && Objects.equals(first.topologyRef(), second.topologyRef());
        if (!exactBoundaryAvailable(first, second)) {
            return sameOwner;
        }
        return sameOwner && first.boundaryRef().equals(second.boundaryRef());
    }

    private static boolean exactBoundaryAvailable(PointerTarget first, PointerTarget second) {
        return !first.boundaryRef().key().isBlank() && !second.boundaryRef().key().isBlank();
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
