package features.dungeon.application.editor;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import features.dungeon.api.DungeonInspectorSnapshot;

public final class DungeonEditorStatePanelRoomNarrationDrafts {
    private final Map<RoomKey, String> visualDrafts = new HashMap<>();
    private final Map<ExitKey, String> exitDrafts = new HashMap<>();

    void update(long selectedMapIdValue, RoomNarrationDraftInput input) {
        RoomNarrationDraftInput safeInput = input == null
                ? new RoomNarrationDraftInput(0L, "", List.of())
                : input;
        RoomKey roomKey = new RoomKey(selectedMapIdValue, safeInput.roomId());
        if (!roomKey.valid()) {
            return;
        }
        visualDrafts.put(roomKey, safeInput.visualDescription());
        Set<ExitKey> visibleExitKeys = new HashSet<>();
        for (ExitNarrationDraftInput exit : safeInput.exits()) {
            ExitKey exitKey = ExitKey.from(selectedMapIdValue, safeInput.roomId(), exit);
            if (!exitKey.valid()) {
                continue;
            }
            visibleExitKeys.add(exitKey);
            exitDrafts.put(exitKey, exit.description());
        }
        exitDrafts.keySet().removeIf(key -> key.selectedMapIdValue() == roomKey.selectedMapIdValue()
                && key.roomId() == roomKey.roomId()
                && !visibleExitKeys.contains(key));
    }

    void clear(long selectedMapIdValue, long roomId) {
        RoomKey roomKey = new RoomKey(selectedMapIdValue, roomId);
        visualDrafts.remove(roomKey);
        exitDrafts.keySet().removeIf(key -> key.selectedMapIdValue() == roomKey.selectedMapIdValue()
                && key.roomId() == roomKey.roomId());
    }

    void retainOnlyVisibleDraftsForMap(long selectedMapIdValue, DungeonInspectorSnapshot inspector) {
        long safeSelectedMapIdValue = Math.max(0L, selectedMapIdValue);
        Set<RoomKey> visibleRoomKeys = new HashSet<>();
        Set<ExitKey> visibleExitKeys = new HashSet<>();
        DungeonInspectorSnapshot safeInspector = inspector == null
                ? new DungeonInspectorSnapshot(
                        "", "", DungeonInspectorSnapshot.StatePanelFacts.empty(), List.of())
                : inspector;
        for (DungeonInspectorSnapshot.RoomNarrationCard card : safeInspector.roomNarrations()) {
            RoomKey roomKey = new RoomKey(safeSelectedMapIdValue, card.roomId());
            if (!roomKey.valid()) {
                continue;
            }
            visibleRoomKeys.add(roomKey);
            for (DungeonInspectorSnapshot.RoomExitNarration exit : card.exits()) {
                visibleExitKeys.add(ExitKey.from(safeSelectedMapIdValue, card.roomId(), exit));
            }
        }
        visualDrafts.keySet().removeIf(key -> key.selectedMapIdValue() == safeSelectedMapIdValue
                && !visibleRoomKeys.contains(key));
        exitDrafts.keySet().removeIf(key -> key.selectedMapIdValue() == safeSelectedMapIdValue
                && !visibleExitKeys.contains(key));
    }

    VisibleDrafts visibleDrafts(long selectedMapIdValue, DungeonInspectorSnapshot inspector) {
        long safeSelectedMapIdValue = Math.max(0L, selectedMapIdValue);
        DungeonInspectorSnapshot safeInspector = inspector == null
                ? new DungeonInspectorSnapshot(
                        "", "", DungeonInspectorSnapshot.StatePanelFacts.empty(), List.of())
                : inspector;
        return new VisibleDrafts(safeInspector.roomNarrations().stream()
                .map(card -> visibleRoomDraft(safeSelectedMapIdValue, card))
                .filter(RoomDraft::hasAnyDraft)
                .toList());
    }

    private RoomDraft visibleRoomDraft(long selectedMapIdValue, DungeonInspectorSnapshot.RoomNarrationCard card) {
        RoomKey roomKey = new RoomKey(selectedMapIdValue, card.roomId());
        boolean visualPresent = visualDrafts.containsKey(roomKey);
        String visualDescription = visualDrafts.getOrDefault(roomKey, "");
        List<ExitDraft> exits = card.exits().stream()
                .map(exit -> visibleExitDraft(selectedMapIdValue, card.roomId(), exit))
                .filter(ExitDraft::present)
                .toList();
        return new RoomDraft(card.roomId(), visualPresent, visualDescription, exits);
    }

    private ExitDraft visibleExitDraft(
            long selectedMapIdValue,
            long roomId,
            DungeonInspectorSnapshot.RoomExitNarration exit
    ) {
        ExitKey key = ExitKey.from(selectedMapIdValue, roomId, exit);
        boolean present = exitDrafts.containsKey(key);
        return new ExitDraft(
                exit.label(),
                exit.cell().q(),
                exit.cell().r(),
                exit.cell().level(),
                exit.direction(),
                exitDrafts.getOrDefault(key, ""),
                present);
    }

    public record VisibleDrafts(List<RoomDraft> rooms) {
        public VisibleDrafts {
            rooms = rooms == null ? List.of() : List.copyOf(rooms);
        }

        public static VisibleDrafts empty() {
            return new VisibleDrafts(List.of());
        }
    }

    public record RoomDraft(
            long roomId,
            boolean visualPresent,
            String visualDescription,
            List<ExitDraft> exits
    ) {
        public RoomDraft {
            roomId = Math.max(0L, roomId);
            visualDescription = visualDescription == null ? "" : visualDescription;
            exits = exits == null ? List.of() : List.copyOf(exits);
        }

        boolean hasAnyDraft() {
            return visualPresent || !exits.isEmpty();
        }
    }

    public record ExitDraft(
            String label,
            int q,
            int r,
            int level,
            String direction,
            String description,
            boolean present
    ) {
        public ExitDraft {
            label = label == null ? "" : label;
            direction = direction == null ? "" : direction;
            description = description == null ? "" : description;
        }
    }

    private record RoomKey(long selectedMapIdValue, long roomId) {
        RoomKey {
            selectedMapIdValue = Math.max(0L, selectedMapIdValue);
            roomId = Math.max(0L, roomId);
        }

        boolean valid() {
            return selectedMapIdValue > 0L && roomId > 0L;
        }
    }

    private record ExitKey(
            long selectedMapIdValue,
            long roomId,
            String label,
            int q,
            int r,
            int level,
            String direction
    ) {
        ExitKey {
            selectedMapIdValue = Math.max(0L, selectedMapIdValue);
            roomId = Math.max(0L, roomId);
            label = label == null ? "" : label;
            direction = direction == null ? "" : direction;
        }

        static ExitKey from(long selectedMapIdValue, long roomId, ExitNarrationDraftInput exit) {
            ExitNarrationDraftInput safeExit = exit == null
                    ? new ExitNarrationDraftInput("", 0, 0, 0, "", "")
                    : exit;
            return new ExitKey(
                    selectedMapIdValue,
                    roomId,
                    safeExit.label(),
                    safeExit.q(),
                    safeExit.r(),
                    safeExit.level(),
                    safeExit.direction());
        }

        static ExitKey from(long selectedMapIdValue, long roomId, DungeonInspectorSnapshot.RoomExitNarration exit) {
            DungeonInspectorSnapshot.RoomExitNarration safeExit = exit == null
                    ? new DungeonInspectorSnapshot.RoomExitNarration("", null, "", "")
                    : exit;
            return new ExitKey(
                    selectedMapIdValue,
                    roomId,
                    safeExit.label(),
                    safeExit.cell().q(),
                    safeExit.cell().r(),
                    safeExit.cell().level(),
                    safeExit.direction());
        }

        boolean valid() {
            return selectedMapIdValue > 0L && roomId > 0L;
        }
    }
}
