package features.dungeon.adapter.javafx.map;

import features.dungeon.adapter.javafx.map.DungeonMapContentModel.PointerTarget;

/** Keeps passive hover state local to the JavaFX map adapter. */
final class DungeonMapFrameConsumption {
    private PointerTarget currentHoverTarget = PointerTarget.empty();

    PointerTarget currentHoverTarget() {
        return currentHoverTarget;
    }

    boolean updateHoverTarget(PointerTarget target) {
        PointerTarget next = selectableHoverTarget(target);
        if (next.equals(currentHoverTarget)) {
            return false;
        }
        currentHoverTarget = next;
        return true;
    }

    boolean clearHoverTarget() {
        return updateHoverTarget(PointerTarget.empty());
    }

    static PointerTarget selectableHoverTarget(PointerTarget target) {
        PointerTarget safeTarget = target == null ? PointerTarget.empty() : target;
        return safeTarget.isEmptyTarget() || safeTarget.isRoomLabelTarget()
                ? PointerTarget.empty()
                : safeTarget;
    }
}
