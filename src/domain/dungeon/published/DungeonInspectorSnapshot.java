package src.domain.dungeon.published;

import java.util.List;

/**
 * Read-only inspector payload published by the dungeon API.
 */
public record DungeonInspectorSnapshot(
        String title,
        String summary,
        List<String> facts,
        List<RoomNarrationCard> roomNarrations
) {

    public DungeonInspectorSnapshot(String title, String summary, List<String> facts) {
        this(title, summary, facts, List.of());
    }

    public DungeonInspectorSnapshot {
        title = title == null || title.isBlank() ? "Dungeon" : title;
        summary = summary == null ? "" : summary;
        facts = facts == null ? List.of() : List.copyOf(facts);
        roomNarrations = roomNarrations == null ? List.of() : List.copyOf(roomNarrations);
    }

    public record RoomNarrationCard(
            long roomId,
            String roomName,
            String visualDescription,
            List<RoomExitNarration> exits
    ) {

        public RoomNarrationCard {
            roomId = Math.max(0L, roomId);
            roomName = roomName == null || roomName.isBlank() ? "Raum" : roomName.trim();
            visualDescription = visualDescription == null ? "" : visualDescription;
            exits = exits == null ? List.of() : List.copyOf(exits);
        }
    }

    public record RoomExitNarration(
            String label,
            DungeonCellRef cell,
            String direction,
            String description
    ) {

        public RoomExitNarration {
            label = label == null || label.isBlank() ? "Ausgang" : label.trim();
            cell = cell == null ? new DungeonCellRef(0, 0, 0) : cell;
            direction = direction == null || direction.isBlank() ? "NORTH" : direction.trim();
            description = description == null ? "" : description;
        }
    }
}
