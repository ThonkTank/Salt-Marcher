package src.features.dungeon.runtime;

import java.util.Locale;

public final class DungeonEditorStatePanelLabelNameDrafts {
    private static final long NO_TARGET_ID = 0L;
    private static final String CLUSTER_KIND = "CLUSTER";
    private static final String ROOM_KIND = "ROOM";

    private Key draftKey = Key.empty();
    private String draftName = "";

    void update(long selectedMapIdValue, String targetKind, long targetId, String name) {
        Key key = Key.from(selectedMapIdValue, targetKind, targetId);
        if (!key.valid()) {
            return;
        }
        draftKey = key;
        draftName = name == null ? "" : name;
    }

    void clear(long selectedMapIdValue, String targetKind, long targetId) {
        if (draftKey.equals(Key.from(selectedMapIdValue, targetKind, targetId))) {
            clearDraft();
        }
    }

    Draft current(long selectedMapIdValue, String targetKind, long targetId) {
        Key key = Key.from(selectedMapIdValue, targetKind, targetId);
        if (!key.valid()) {
            return Draft.empty();
        }
        if (!draftKey.equals(key)) {
            return Draft.target(key.targetKind(), key.targetId());
        }
        return new Draft(key.targetKind(), key.targetId(), draftName, true);
    }

    void retainOnlyVisibleDraftForMap(long selectedMapIdValue, String targetKind, long targetId) {
        Key visible = Key.from(selectedMapIdValue, targetKind, targetId);
        if (draftKey.selectedMapIdValue() == Math.max(0L, selectedMapIdValue)
                && (!visible.valid() || !draftKey.equals(visible))) {
            clearDraft();
        }
    }

    private void clearDraft() {
        draftKey = Key.empty();
        draftName = "";
    }

    public record Draft(String targetKind, long targetId, String name, boolean present) {
        public Draft {
            targetKind = normalizeTargetKind(targetKind);
            targetId = Math.max(NO_TARGET_ID, targetId);
            name = name == null ? "" : name;
            present = present && targetId > NO_TARGET_ID && !targetKind.isBlank();
        }

        public static Draft empty() {
            return new Draft("", NO_TARGET_ID, "", false);
        }

        static Draft target(String targetKind, long targetId) {
            return new Draft(targetKind, targetId, "", false);
        }

        public boolean targetPresent() {
            return targetId > NO_TARGET_ID && (CLUSTER_KIND.equals(targetKind) || ROOM_KIND.equals(targetKind));
        }

        public String fallbackName() {
            return CLUSTER_KIND.equals(targetKind) ? "Cluster " + targetId : "Raum " + targetId;
        }

        public String label() {
            return CLUSTER_KIND.equals(targetKind) ? "Cluster-Name" : "Raum-Name";
        }

    }

    private record Key(long selectedMapIdValue, String targetKind, long targetId) {
        Key {
            selectedMapIdValue = Math.max(0L, selectedMapIdValue);
            targetKind = normalizeTargetKind(targetKind);
            targetId = Math.max(NO_TARGET_ID, targetId);
        }

        static Key from(long selectedMapIdValue, String targetKind, long targetId) {
            return new Key(selectedMapIdValue, targetKind, targetId);
        }

        static Key empty() {
            return new Key(0L, "", NO_TARGET_ID);
        }

        boolean valid() {
            return selectedMapIdValue > 0L && targetId > NO_TARGET_ID
                    && (CLUSTER_KIND.equals(targetKind) || ROOM_KIND.equals(targetKind));
        }
    }

    private static String normalizeTargetKind(String targetKind) {
        return targetKind == null ? "" : targetKind.trim().toUpperCase(Locale.ROOT);
    }
}
