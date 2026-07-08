package src.features.dungeon.runtime;

public final class DungeonEditorStatePanelLabelNameDrafts {
    private Key draftKey = Key.empty();
    private String draftName = "";

    void update(long selectedMapIdValue, DungeonEditorRuntimeLabelTarget target, String name) {
        Key key = Key.from(selectedMapIdValue, target);
        if (!key.valid()) {
            return;
        }
        draftKey = key;
        draftName = name == null ? "" : name;
    }

    void clear(long selectedMapIdValue, DungeonEditorRuntimeLabelTarget target) {
        if (draftKey.equals(Key.from(selectedMapIdValue, target))) {
            clearDraft();
        }
    }

    Draft current(long selectedMapIdValue, DungeonEditorRuntimeLabelTarget target) {
        Key key = Key.from(selectedMapIdValue, target);
        if (!key.valid()) {
            return Draft.empty();
        }
        if (!draftKey.equals(key)) {
            return Draft.target(key.target());
        }
        return new Draft(key.target(), draftName, true);
    }

    void retainOnlyVisibleDraftForMap(long selectedMapIdValue, DungeonEditorRuntimeLabelTarget target) {
        Key visible = Key.from(selectedMapIdValue, target);
        if (draftKey.selectedMapIdValue() == Math.max(0L, selectedMapIdValue)
                && (!visible.valid() || !draftKey.equals(visible))) {
            clearDraft();
        }
    }

    private void clearDraft() {
        draftKey = Key.empty();
        draftName = "";
    }

    public record Draft(DungeonEditorRuntimeLabelTarget target, String name, boolean present) {
        public Draft {
            target = DungeonEditorRuntimeLabelTarget.orEmpty(target);
            name = name == null ? "" : name;
            present = present && target.present();
        }

        public static Draft empty() {
            return new Draft(DungeonEditorRuntimeLabelTarget.empty(), "", false);
        }

        static Draft target(DungeonEditorRuntimeLabelTarget target) {
            return new Draft(target, "", false);
        }

        public boolean targetPresent() {
            return target.present();
        }

        public String fallbackName() {
            return target.fallbackName();
        }

        public String label() {
            return target.label();
        }

    }

    private record Key(long selectedMapIdValue, DungeonEditorRuntimeLabelTarget target) {
        Key {
            selectedMapIdValue = Math.max(0L, selectedMapIdValue);
            target = DungeonEditorRuntimeLabelTarget.orEmpty(target);
        }

        static Key from(long selectedMapIdValue, DungeonEditorRuntimeLabelTarget target) {
            return new Key(selectedMapIdValue, target);
        }

        static Key empty() {
            return new Key(0L, DungeonEditorRuntimeLabelTarget.empty());
        }

        boolean valid() {
            return selectedMapIdValue > 0L && target.present();
        }
    }
}
