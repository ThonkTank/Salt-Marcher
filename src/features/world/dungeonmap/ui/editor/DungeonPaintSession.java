package features.world.dungeonmap.ui.editor;

import features.world.dungeonmap.model.DungeonMapState;
import features.world.dungeonmap.model.DungeonSquarePaint;
import features.world.dungeonmap.ui.canvas.DungeonMapPane;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

final class DungeonPaintSession {

    @FunctionalInterface
    interface PaintPersister {
        void persist(long mapId, List<DungeonSquarePaint> paints);
    }

    private final DungeonMapPane canvas;
    private final Map<String, DungeonSquarePaint> pendingPaints = new LinkedHashMap<>();
    private Long pendingMapId;

    DungeonPaintSession(DungeonMapPane canvas) {
        this.canvas = canvas;
    }

    void previewPaint(Long currentMapId, DungeonMapState currentState, DungeonSquarePaint paint) {
        if (currentState == null || currentMapId == null) {
            return;
        }
        if (pendingMapId != null && !pendingMapId.equals(currentMapId)) {
            discardPendingPaints();
        }
        pendingMapId = currentMapId;
        pendingPaints.put(paint.x() + ":" + paint.y(), paint);
        canvas.previewPaint(paint);
    }

    void flushPendingPaints(Long currentMapId, PaintPersister persister) {
        if (pendingPaints.isEmpty()) {
            return;
        }
        if (currentMapId == null || pendingMapId == null || !pendingMapId.equals(currentMapId)) {
            discardPendingPaints();
            return;
        }
        List<DungeonSquarePaint> paints = new ArrayList<>(pendingPaints.values());
        pendingPaints.clear();
        pendingMapId = null;
        persister.persist(currentMapId, paints);
    }

    void discardPendingPaints() {
        pendingPaints.clear();
        pendingMapId = null;
    }

    boolean hasPendingPaints() {
        return !pendingPaints.isEmpty();
    }
}
