package src.view.slotcontent.main.dungeonmap;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import src.features.dungeon.runtime.DungeonEditorCellHitRefs;
import src.features.dungeon.runtime.DungeonEditorPreparedFrameFacts.MapSurfaceFrame;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.CellTarget;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.MapInteractionFrame;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.PointerTarget;

final class DungeonMapFrameConsumptionContentPartModel {
    private MapSurfaceFrame currentEditorSurfaceFrame = MapSurfaceFrame.empty();
    private MapInteractionFrame currentMapInteractionFrame = MapInteractionFrame.empty();
    private boolean editorSurfaceFrameCurrent;
    private PointerTarget currentHoverTarget = PointerTarget.empty();
    private SyntheticHoverContext currentSurfaceContext = SyntheticHoverContext.empty();
    private SyntheticHoverContext currentHoverContext = SyntheticHoverContext.empty();

    EditorSurfaceFrame consumeEditorSurfaceFrame(
            MapSurfaceFrame editorSurfaceFrame,
            MapInteractionFrame interactionFrame
    ) {
        MapSurfaceFrame safeSurfaceFrame = editorSurfaceFrame == null
                ? MapSurfaceFrame.empty()
                : editorSurfaceFrame;
        MapInteractionFrame safeFrame = interactionFrame == null ? MapInteractionFrame.empty() : interactionFrame;
        SyntheticHoverContext nextSurfaceContext = SyntheticHoverContext.from(safeSurfaceFrame);
        if (editorSurfaceFrameCurrent
                && sameRenderRelevantSurface(safeSurfaceFrame, currentEditorSurfaceFrame)
                && sameRenderRelevantInteractionFrame(safeFrame, currentMapInteractionFrame)) {
            currentEditorSurfaceFrame = safeSurfaceFrame;
            currentMapInteractionFrame = safeFrame;
            currentSurfaceContext = nextSurfaceContext;
            return EditorSurfaceFrame.unchanged(safeSurfaceFrame, safeFrame);
        }
        currentEditorSurfaceFrame = safeSurfaceFrame;
        currentMapInteractionFrame = safeFrame;
        currentSurfaceContext = nextSurfaceContext;
        editorSurfaceFrameCurrent = true;
        return EditorSurfaceFrame.changed(safeSurfaceFrame, safeFrame);
    }

    MapInteractionFrame consumeTravelSnapshot() {
        editorSurfaceFrameCurrent = false;
        currentEditorSurfaceFrame = MapSurfaceFrame.empty();
        currentMapInteractionFrame = MapInteractionFrame.empty();
        currentSurfaceContext = SyntheticHoverContext.empty();
        currentHoverContext = SyntheticHoverContext.empty();
        currentHoverTarget = PointerTarget.empty();
        return currentMapInteractionFrame;
    }

    PointerTarget consumeRenderFrame(MapInteractionFrame interactionFrame) {
        MapInteractionFrame safeFrame = interactionFrame == null ? MapInteractionFrame.empty() : interactionFrame;
        Map<String, PointerTarget> pointerTargets = withExactCellTargets(safeFrame.pointerTargets());
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

        static SyntheticHoverContext from(MapSurfaceFrame frame) {
            MapSurfaceFrame safeFrame = frame == null
                    ? MapSurfaceFrame.empty()
                    : frame;
            return new SyntheticHoverContext(
                    safeFrame.viewMode().name(),
                    safeFrame.projectionLevel());
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
            case MARKER -> sameCellOwner(safeFirst, safeSecond);
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
        DungeonEditorCellHitRefs.ExactCellHitRef exactCell = DungeonEditorCellHitRefs.parseExactCell(hitRef);
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

    private static boolean sameRenderRelevantSurface(
            MapSurfaceFrame first,
            MapSurfaceFrame second
    ) {
        return Objects.equals(first.surface(), second.surface())
                && Objects.equals(first.selection(), second.selection())
                && Objects.equals(first.previewRender(), second.previewRender())
                && Objects.equals(first.previewRenderDiff(), second.previewRenderDiff())
                && first.viewMode() == second.viewMode()
                && Objects.equals(first.overlaySettings(), second.overlaySettings())
                && first.projectionLevel() == second.projectionLevel();
    }

    private static boolean sameRenderRelevantInteractionFrame(
            MapInteractionFrame first,
            MapInteractionFrame second
    ) {
        return Objects.equals(first.pointerTargets(), second.pointerTargets())
                && Objects.equals(first.previewHandleHitRefs(), second.previewHandleHitRefs());
    }

    private static boolean exactBoundaryAvailable(PointerTarget first, PointerTarget second) {
        return !first.boundaryRef().key().isBlank() && !second.boundaryRef().key().isBlank();
    }

    record EditorSurfaceFrame(
            boolean changed,
            MapSurfaceFrame editorSurfaceFrame,
            MapInteractionFrame interactionFrame
    ) {

        private static EditorSurfaceFrame changed(
                MapSurfaceFrame editorSurfaceFrame,
                MapInteractionFrame interactionFrame
        ) {
            return new EditorSurfaceFrame(true, editorSurfaceFrame, interactionFrame);
        }

        private static EditorSurfaceFrame unchanged(
                MapSurfaceFrame editorSurfaceFrame,
                MapInteractionFrame interactionFrame
        ) {
            return new EditorSurfaceFrame(false, editorSurfaceFrame, interactionFrame);
        }
    }
}
