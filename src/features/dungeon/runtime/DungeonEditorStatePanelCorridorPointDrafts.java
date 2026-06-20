package src.features.dungeon.runtime;

import java.util.Locale;
import src.domain.dungeon.published.DungeonEditorStateSnapshot;
import src.features.dungeon.runtime.DungeonEditorRuntimeOperations.HandleTarget;

public final class DungeonEditorStatePanelCorridorPointDrafts {
    private static final String CORRIDOR_KIND = "CORRIDOR";
    private static final String CORRIDOR_ANCHOR_KIND = "CORRIDOR_ANCHOR";
    private static final String CORRIDOR_WAYPOINT_KIND = "CORRIDOR_WAYPOINT";

    private Key draftKey = Key.empty();
    private String draftQ = "";
    private String draftR = "";

    void update(long selectedMapIdValue, DungeonEditorStateSnapshot.Selection selection, String q, String r) {
        HandleTarget target = DungeonEditorStatePanelCorridorPointTarget.from(selection);
        Key key = Key.from(selectedMapIdValue, target);
        if (!key.valid()) {
            return;
        }
        draftKey = key;
        draftQ = cleanCoordinate(q);
        draftR = cleanCoordinate(r);
    }

    void move(
            long selectedMapIdValue,
            DungeonEditorStateSnapshot.Selection selection,
            int q,
            int r,
            DungeonEditorAuthoredRuntimeOperations operationOwner
    ) {
        HandleTarget target = DungeonEditorStatePanelCorridorPointTarget.from(selection);
        Key key = Key.from(selectedMapIdValue, target);
        if (!key.valid() || operationOwner == null) {
            return;
        }
        if (draftKey.equals(key)) {
            clearDraft();
        }
        operationOwner.moveHandle(target, q, r);
    }

    Draft current(long selectedMapIdValue, DungeonEditorStateSnapshot.Selection selection) {
        HandleTarget target = DungeonEditorStatePanelCorridorPointTarget.from(selection);
        Key key = Key.from(selectedMapIdValue, target);
        if (!key.valid()) {
            return Draft.empty();
        }
        if (!draftKey.equals(key)) {
            return Draft.target(target);
        }
        return new Draft(
                true,
                true,
                labelFor(target),
                draftQ,
                draftR,
                Integer.toString(target.level()));
    }

    void retainOnlyVisibleDraftForMap(long selectedMapIdValue, DungeonEditorStateSnapshot.Selection selection) {
        Key visible = Key.from(selectedMapIdValue, DungeonEditorStatePanelCorridorPointTarget.from(selection));
        if (draftKey.selectedMapIdValue() == Math.max(0L, selectedMapIdValue)
                && (!visible.valid() || !draftKey.equals(visible))) {
            clearDraft();
        }
    }

    private void clearDraft() {
        draftKey = Key.empty();
        draftQ = "";
        draftR = "";
    }

    private static String cleanCoordinate(String value) {
        return value == null ? "" : value.strip();
    }

    public record Draft(boolean targetPresent, boolean present, String label, String q, String r, String level) {
        public Draft {
            label = label == null || label.isBlank() ? "Korridorpunkt" : label;
            q = cleanCoordinate(q);
            r = cleanCoordinate(r);
            level = level == null ? "" : level.strip();
        }

        public static Draft empty() {
            return new Draft(false, false, "", "", "", "");
        }

        static Draft target(HandleTarget handle) {
            HandleTarget safeHandle = handle == null ? HandleTarget.empty() : handle;
            return new Draft(
                    true,
                    false,
                    labelFor(safeHandle),
                    Integer.toString(safeHandle.q()),
                    Integer.toString(safeHandle.r()),
                    Integer.toString(safeHandle.level()));
        }

    }

    private static String labelFor(HandleTarget handle) {
        return DungeonEditorStatePanelCorridorPointTarget.labelFor(handle);
    }

    private record Key(
            long selectedMapIdValue,
            String kind,
            String topologyKind,
            long topologyId,
            long corridorId,
            int index
    ) {
        Key {
            selectedMapIdValue = Math.max(0L, selectedMapIdValue);
            kind = normalize(kind);
            topologyKind = normalize(topologyKind);
            topologyId = Math.max(0L, topologyId);
            corridorId = Math.max(0L, corridorId);
            index = Math.max(0, index);
        }

        static Key from(long selectedMapIdValue, HandleTarget handle) {
            HandleTarget safeHandle = handle == null ? HandleTarget.empty() : handle;
            return new Key(
                    selectedMapIdValue,
                    safeHandle.kind(),
                    safeHandle.topologyKind(),
                    safeHandle.topologyId(),
                    safeHandle.corridorId(),
                    safeHandle.orderIndex());
        }

        static Key empty() {
            return new Key(0L, "", "", 0L, 0L, 0);
        }

        boolean valid() {
            return selectedMapIdValue > 0L
                    && (CORRIDOR_ANCHOR_KIND.equals(kind) || CORRIDOR_WAYPOINT_KIND.equals(kind))
                    && (CORRIDOR_KIND.equals(topologyKind) || CORRIDOR_ANCHOR_KIND.equals(topologyKind))
                    && topologyId > 0L;
        }
    }

    private static String normalize(String value) {
        return value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
    }
}
