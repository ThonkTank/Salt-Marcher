package features.dungeon.application.editor;

public final class DungeonEditorStatePanelStairGeometryDrafts {
    private static final long NO_STAIR_ID = 0L;

    private Key draftKey = Key.empty();
    private DraftValue draftValue = DraftValue.empty();

    void update(long selectedMapIdValue, StairGeometryDraftInput input) {
        StairGeometryDraftInput safeInput = input == null
                ? StairGeometryDraftInput.empty()
                : input;
        Key key = Key.from(selectedMapIdValue, safeInput.stairId());
        if (!key.valid()) {
            return;
        }
        draftKey = key;
        draftValue = DraftValue.from(safeInput);
    }

    void clear(long selectedMapIdValue, long stairId) {
        if (draftKey.equals(Key.from(selectedMapIdValue, stairId))) {
            clearDraft();
        }
    }

    Draft current(long selectedMapIdValue, long stairId) {
        Key key = Key.from(selectedMapIdValue, stairId);
        if (!key.valid()) {
            return Draft.empty();
        }
        if (!draftKey.equals(key)) {
            return Draft.target(stairId);
        }
        return new Draft(
                true,
                stairId,
                draftValue.shapeName(),
                draftValue.directionName(),
                draftValue.dimension1(),
                draftValue.dimension2(),
                true);
    }

    void retainOnlyVisibleDraftForMap(long selectedMapIdValue, long stairId) {
        Key visible = Key.from(selectedMapIdValue, stairId);
        if (draftKey.selectedMapIdValue() == Math.max(0L, selectedMapIdValue)
                && (!visible.valid() || !draftKey.equals(visible))) {
            clearDraft();
        }
    }

    private void clearDraft() {
        draftKey = Key.empty();
        draftValue = DraftValue.empty();
    }

    public record Draft(
            boolean targetPresent,
            long stairId,
            String shapeName,
            String directionName,
            String dimension1,
            String dimension2,
            boolean present
    ) {
        public Draft {
            stairId = Math.max(NO_STAIR_ID, stairId);
            shapeName = cleanValue(shapeName);
            directionName = cleanValue(directionName);
            dimension1 = cleanValue(dimension1);
            dimension2 = cleanValue(dimension2);
            present = present && targetPresent && stairId > NO_STAIR_ID;
        }

        public static Draft empty() {
            return new Draft(false, NO_STAIR_ID, "", "", "", "", false);
        }

        static Draft target(long stairId) {
            return new Draft(true, stairId, "", "", "", "", false);
        }
    }

    private record DraftValue(String shapeName, String directionName, String dimension1, String dimension2) {
        DraftValue {
            shapeName = cleanValue(shapeName);
            directionName = cleanValue(directionName);
            dimension1 = cleanValue(dimension1);
            dimension2 = cleanValue(dimension2);
        }

        static DraftValue empty() {
            return new DraftValue("", "", "", "");
        }

        static DraftValue from(StairGeometryDraftInput input) {
            StairGeometryDraftInput safeInput = input == null
                    ? StairGeometryDraftInput.empty()
                    : input;
            return new DraftValue(
                    safeInput.shapeName(),
                    safeInput.directionName(),
                    safeInput.dimension1(),
                    safeInput.dimension2());
        }
    }

    private record Key(long selectedMapIdValue, long stairId) {
        Key {
            selectedMapIdValue = Math.max(0L, selectedMapIdValue);
            stairId = Math.max(NO_STAIR_ID, stairId);
        }

        static Key from(long selectedMapIdValue, long stairId) {
            return new Key(selectedMapIdValue, stairId);
        }

        static Key empty() {
            return new Key(0L, NO_STAIR_ID);
        }

        boolean valid() {
            return selectedMapIdValue > 0L && stairId > NO_STAIR_ID;
        }
    }

    private static String cleanValue(String value) {
        return value == null ? "" : value.strip();
    }
}
