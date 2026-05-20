package src.domain.dungeon.published;

import java.util.List;

public record SaveDungeonEditorRoomNarrationCommand(
        long roomId,
        String visualDescription,
        List<ExitNarration> exits
) {
    public SaveDungeonEditorRoomNarrationCommand {
        roomId = Math.max(0L, roomId);
        visualDescription = visualDescription == null ? "" : visualDescription;
        exits = safeExits(exits);
    }

    public record ExitNarration(
            String label,
            int q,
            int r,
            int level,
            String direction,
            String description
    ) {
        public ExitNarration {
            label = label == null ? "" : label;
            direction = direction == null ? "" : direction;
            description = description == null ? "" : description;
        }
    }

    private static List<ExitNarration> safeExits(List<ExitNarration> exits) {
        return exits == null
                ? List.of()
                : exits.stream()
                        .map(exit -> exit == null ? new ExitNarration("", 0, 0, 0, "", "") : exit)
                        .toList();
    }
}
