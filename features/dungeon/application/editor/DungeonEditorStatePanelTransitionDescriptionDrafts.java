package features.dungeon.application.editor;

public final class DungeonEditorStatePanelTransitionDescriptionDrafts {
    private static final long NO_TRANSITION_ID = 0L;

    private Key draftKey = Key.empty();
    private String draftDescription = "";

    void update(long selectedMapIdValue, long transitionId, String description) {
        Key key = Key.from(selectedMapIdValue, transitionId);
        if (!key.valid()) {
            return;
        }
        draftKey = key;
        draftDescription = description == null ? "" : description;
    }

    void clear(long selectedMapIdValue, long transitionId) {
        if (draftKey.equals(Key.from(selectedMapIdValue, transitionId))) {
            clearDraft();
        }
    }

    Draft current(long selectedMapIdValue, long transitionId) {
        Key key = Key.from(selectedMapIdValue, transitionId);
        if (!key.valid()) {
            return Draft.empty();
        }
        if (!draftKey.equals(key)) {
            return Draft.target(transitionId);
        }
        return new Draft(transitionId, draftDescription, true);
    }

    void retainOnlyVisibleDraftForMap(long selectedMapIdValue, long transitionId) {
        Key visible = Key.from(selectedMapIdValue, transitionId);
        if (draftKey.selectedMapIdValue() == Math.max(0L, selectedMapIdValue)
                && (!visible.valid() || !draftKey.equals(visible))) {
            clearDraft();
        }
    }

    private void clearDraft() {
        draftKey = Key.empty();
        draftDescription = "";
    }

    public record Draft(long transitionId, String description, boolean present) {
        public Draft {
            transitionId = Math.max(NO_TRANSITION_ID, transitionId);
            description = description == null ? "" : description;
            present = present && transitionId > NO_TRANSITION_ID;
        }

        public static Draft empty() {
            return new Draft(NO_TRANSITION_ID, "", false);
        }

        static Draft target(long transitionId) {
            return new Draft(transitionId, "", false);
        }

        public boolean targetPresent() {
            return transitionId > NO_TRANSITION_ID;
        }
    }

    private record Key(long selectedMapIdValue, long transitionId) {
        Key {
            selectedMapIdValue = Math.max(0L, selectedMapIdValue);
            transitionId = Math.max(NO_TRANSITION_ID, transitionId);
        }

        static Key from(long selectedMapIdValue, long transitionId) {
            return new Key(selectedMapIdValue, transitionId);
        }

        static Key empty() {
            return new Key(0L, NO_TRANSITION_ID);
        }

        boolean valid() {
            return selectedMapIdValue > 0L && transitionId > NO_TRANSITION_ID;
        }
    }
}
