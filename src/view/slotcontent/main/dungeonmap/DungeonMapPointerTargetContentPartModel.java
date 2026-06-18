package src.view.slotcontent.main.dungeonmap;

import java.util.List;
import java.util.Map;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.CanvasHit;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.PointerTarget;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel.PointerTargetKind;

final class DungeonMapPointerTargetContentPartModel {
    private static final String FEATURE_MARKER_ELEMENT_KIND = "FEATURE_MARKER";
    private static final String ROOM_ELEMENT_KIND = "ROOM";

    PointerTarget choosePrimary(List<CanvasHit> hits, Map<String, PointerTarget> pointerTargets) {
        PointerTarget bestTarget = PointerTarget.empty();
        int bestPriority = Integer.MAX_VALUE;
        for (CanvasHit hit : hits) {
            PointerTarget candidate = pointerTargets.getOrDefault(hit.hitRef(), PointerTarget.empty());
            int candidatePriority = priority(candidate);
            if (candidatePriority < bestPriority) {
                bestTarget = candidate;
                bestPriority = candidatePriority;
            }
        }
        return bestTarget;
    }

    private int priority(PointerTarget target) {
        PointerTarget safeTarget = target == null ? PointerTarget.empty() : target;
        if (safeTarget.targetKind() == PointerTargetKind.LABEL) {
            return labelPriority(safeTarget);
        }
        return switch (safeTarget.targetKind()) {
            case HANDLE -> 0;
            case BOUNDARY -> 3;
            case CELL -> roomCell(safeTarget) ? 4 : featureCell(safeTarget) ? 5 : 6;
            case GRAPH_NODE -> 7;
            default -> Integer.MAX_VALUE;
        };
    }

    private boolean roomCell(PointerTarget target) {
        return ROOM_ELEMENT_KIND.equals(target.elementKind());
    }

    private boolean featureCell(PointerTarget target) {
        return FEATURE_MARKER_ELEMENT_KIND.equals(target.elementKind());
    }

    private int labelPriority(PointerTarget target) {
        if (target.isClusterLabelTarget()) {
            return 1;
        }
        return target.isRoomLabelTarget() ? 2 : 6;
    }
}
