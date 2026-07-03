package src.features.dungeon.runtime;

import src.domain.dungeon.model.core.structure.transition.TransitionDestinationType;
import src.domain.dungeon.published.DungeonEditorControlsSnapshot;
import src.domain.dungeon.published.DungeonEditorStateSnapshot;
import src.domain.dungeon.published.DungeonEditorTool;
import src.domain.dungeon.published.DungeonEditorTopologyElementRef;

public final class DungeonEditorStatePanelTransitionDestinationDrafts {
    private static final TransitionDestinationType DEFAULT_DESTINATION_TYPE =
            TransitionDestinationType.UNLINKED_ENTRANCE;
    private Key draftKey = Key.empty();
    private DraftValue draftValue = DraftValue.defaultValue();

    void update(
            long selectedMapIdValue,
            boolean targetVisible,
            long sourceTransitionId,
            TransitionDestinationDraftInput input
    ) {
        Key key = Key.from(selectedMapIdValue, targetVisible, sourceTransitionId);
        if (!key.valid()) {
            return;
        }
        draftKey = key;
        draftValue = DraftValue.from(input);
    }

    void clear(long selectedMapIdValue, long sourceTransitionId) {
        if (draftKey.equals(Key.from(selectedMapIdValue, true, sourceTransitionId))) {
            clearDraft();
        }
    }

    Draft current(long selectedMapIdValue, boolean targetVisible, long sourceTransitionId) {
        Key key = Key.from(selectedMapIdValue, targetVisible, sourceTransitionId);
        if (!key.valid()) {
            return Draft.empty();
        }
        if (!draftKey.equals(key)) {
            return Draft.target(sourceTransitionId);
        }
        return new Draft(
                true,
                sourceTransitionId,
                draftValue.destinationType(),
                draftValue.mapId(),
                draftValue.tileId(),
                draftValue.transitionId(),
                draftValue.bidirectional(),
                true);
    }

    void retainOnlyVisibleDraftForMap(long selectedMapIdValue, boolean targetVisible, long sourceTransitionId) {
        Key visible = Key.from(selectedMapIdValue, targetVisible, sourceTransitionId);
        if (draftKey.selectedMapIdValue() == Math.max(0L, selectedMapIdValue)
                && (!visible.valid() || !draftKey.equals(visible))) {
            clearDraft();
        }
    }

    static Target target(DungeonEditorControlsSnapshot controls, DungeonEditorStateSnapshot state) {
        boolean transitionCreate = controls != null && DungeonEditorTool.TRANSITION_CREATE == controls.selectedTool();
        long selectedTransitionId = selectedTransitionId(state == null ? null : state.selection());
        return transitionCreate
                ? new Target(true, 0L)
                : new Target(selectedTransitionId > 0L, selectedTransitionId);
    }

    private void clearDraft() {
        draftKey = Key.empty();
        draftValue = DraftValue.defaultValue();
    }

    public record Draft(
            boolean targetPresent,
            long sourceTransitionId,
            TransitionDestinationType destinationType,
            String mapId,
            String tileId,
            String transitionId,
            boolean bidirectional,
            boolean present
    ) {
        public Draft {
            sourceTransitionId = Math.max(0L, sourceTransitionId);
            destinationType = normalizeDestinationType(destinationType);
            mapId = cleanValue(mapId);
            tileId = cleanValue(tileId);
            transitionId = cleanValue(transitionId);
            present = present && targetPresent;
        }

        public static Draft empty() {
            return new Draft(false, 0L, DEFAULT_DESTINATION_TYPE, "", "", "", true, false);
        }

        public String destinationTypeKey() {
            return destinationType.name();
        }

        static Draft target(long sourceTransitionId) {
            return new Draft(true, sourceTransitionId, DEFAULT_DESTINATION_TYPE, "", "", "", true, false);
        }
    }

    private record DraftValue(
            TransitionDestinationType destinationType,
            String mapId,
            String tileId,
            String transitionId,
            boolean bidirectional
    ) {
        DraftValue {
            destinationType = normalizeDestinationType(destinationType);
            mapId = cleanValue(mapId);
            tileId = cleanValue(tileId);
            transitionId = cleanValue(transitionId);
        }

        static DraftValue defaultValue() {
            return new DraftValue(DEFAULT_DESTINATION_TYPE, "", "", "", true);
        }

        static DraftValue from(TransitionDestinationDraftInput input) {
            TransitionDestinationDraftInput safeInput = input == null
                    ? new TransitionDestinationDraftInput(DEFAULT_DESTINATION_TYPE, "", "", "", true)
                    : input;
            return new DraftValue(
                    safeInput.destinationType(),
                    safeInput.mapId(),
                    safeInput.tileId(),
                    safeInput.transitionId(),
                    safeInput.bidirectional());
        }
    }

    private record Key(long selectedMapIdValue, long sourceTransitionId) {
        Key {
            selectedMapIdValue = Math.max(0L, selectedMapIdValue);
            sourceTransitionId = Math.max(0L, sourceTransitionId);
        }

        static Key from(long selectedMapIdValue, boolean targetVisible, long sourceTransitionId) {
            return targetVisible
                    ? new Key(selectedMapIdValue, Math.max(0L, sourceTransitionId))
                    : empty();
        }

        static Key empty() {
            return new Key(0L, 0L);
        }

        boolean valid() {
            return selectedMapIdValue > 0L;
        }
    }

    private static TransitionDestinationType normalizeDestinationType(TransitionDestinationType destinationType) {
        return destinationType == null ? DEFAULT_DESTINATION_TYPE : destinationType;
    }

    private static String cleanValue(String value) {
        return value == null ? "" : value.strip();
    }

    private static long selectedTransitionId(DungeonEditorStateSnapshot.Selection selection) {
        DungeonEditorTopologyElementRef topologyRef = selection == null
                ? DungeonEditorTopologyElementRef.empty()
                : selection.topologyRef();
        return "TRANSITION".equals(topologyRef.kind()) ? topologyRef.id() : 0L;
    }

    record Target(boolean visible, long sourceTransitionId) {
        Target {
            sourceTransitionId = Math.max(0L, sourceTransitionId);
        }
    }
}
