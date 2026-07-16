package features.dungeon.application.editor;

import java.util.List;

public record RoomNarrationDraftInput(
        long roomId,
        String visualDescription,
        List<ExitNarrationDraftInput> exits
) {
    public RoomNarrationDraftInput {
        roomId = Math.max(0L, roomId);
        visualDescription = safeText(visualDescription);
        exits = exits == null ? List.of() : List.copyOf(exits);
    }

    private static String safeText(String value) {
        return value == null ? "" : value;
    }
}
