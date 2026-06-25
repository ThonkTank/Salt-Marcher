package src.features.dungeon.runtime;

import java.util.List;

public record RoomNarration(
        long roomId,
        String visualDescription,
        List<ExitNarration> exits
) {
    public RoomNarration {
        roomId = Math.max(0L, roomId);
        visualDescription = safeText(visualDescription);
        exits = exits == null ? List.of() : List.copyOf(exits);
    }

    private static String safeText(String value) {
        return value == null ? "" : value;
    }
}
