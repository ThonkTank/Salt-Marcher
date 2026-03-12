package features.world.dungeonmap.ui.editor;

import features.world.dungeonmap.model.DungeonMapState;
import features.world.dungeonmap.model.DungeonWallEdit;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

final class DungeonWallPaintSession {

    @FunctionalInterface
    interface WallEditPersister {
        void persist(long mapId, List<DungeonWallEdit> edits);
    }

    private final java.util.function.Consumer<List<DungeonWallEdit>> committedPreview;
    private final Map<String, DungeonWallEdit> pendingEdits = new LinkedHashMap<>();
    private final Map<String, DungeonWallEdit> committedPreviewEdits = new LinkedHashMap<>();
    private Long pendingMapId;

    DungeonWallPaintSession(java.util.function.Consumer<List<DungeonWallEdit>> committedPreview) {
        this.committedPreview = committedPreview;
    }

    void previewEdit(Long currentMapId, DungeonMapState currentState, DungeonWallEdit edit) {
        if (currentState == null || currentMapId == null) {
            return;
        }
        ensureActiveMap(currentMapId);
        pendingMapId = currentMapId;
        pendingEdits.put(edit.edgeKey(), edit);
        committedPreviewEdits.put(edit.edgeKey(), edit);
        refreshCommittedPreview();
    }

    void previewPathCommit(Long currentMapId, DungeonMapState currentState, List<DungeonWallEdit> edits) {
        if (currentState == null || currentMapId == null || edits == null || edits.isEmpty()) {
            return;
        }
        ensureActiveMap(currentMapId);
        pendingMapId = currentMapId;
        for (DungeonWallEdit edit : edits) {
            pendingEdits.put(edit.edgeKey(), edit);
            committedPreviewEdits.put(edit.edgeKey(), edit);
        }
        refreshCommittedPreview();
    }

    void flushPendingEdits(Long currentMapId, WallEditPersister persister) {
        if (pendingEdits.isEmpty()) {
            return;
        }
        if (currentMapId == null || pendingMapId == null || !pendingMapId.equals(currentMapId)) {
            discardPendingEdits();
            return;
        }
        List<DungeonWallEdit> edits = new ArrayList<>(pendingEdits.values());
        pendingEdits.clear();
        pendingMapId = null;
        persister.persist(currentMapId, edits);
    }

    void discardPendingEdits() {
        pendingEdits.clear();
        committedPreviewEdits.clear();
        pendingMapId = null;
        refreshCommittedPreview();
    }

    boolean hasPendingEdits() {
        return !pendingEdits.isEmpty();
    }

    private void ensureActiveMap(Long currentMapId) {
        if (pendingMapId != null && !pendingMapId.equals(currentMapId)) {
            discardPendingEdits();
        }
    }

    private void refreshCommittedPreview() {
        committedPreview.accept(new ArrayList<>(committedPreviewEdits.values()));
    }
}
