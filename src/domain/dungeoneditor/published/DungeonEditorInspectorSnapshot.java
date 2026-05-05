package src.domain.dungeoneditor.published;

import java.util.List;

public record DungeonEditorInspectorSnapshot(
        String title,
        String summary,
        List<String> facts,
        List<RoomNarrationCard> roomNarrations
) {

    public DungeonEditorInspectorSnapshot {
        title = normalizeTitle(title);
        summary = normalizeSummary(summary);
        facts = normalizeFacts(facts);
        roomNarrations = normalizeRoomNarrations(roomNarrations);
    }

    @Override
    public List<String> facts() {
        return List.copyOf(facts);
    }

    @Override
    public List<RoomNarrationCard> roomNarrations() {
        return List.copyOf(roomNarrations);
    }

    public record RoomNarrationCard(
            long roomId,
            String roomName,
            String visualDescription,
            List<RoomExitNarration> exits
    ) {

        public RoomNarrationCard {
            roomId = normalizeRoomId(roomId);
            roomName = normalizeRoomName(roomName);
            visualDescription = normalizeVisualDescription(visualDescription);
            exits = normalizeExits(exits);
        }

        @Override
        public List<RoomExitNarration> exits() {
            return List.copyOf(exits);
        }
    }

    public record RoomExitNarration(
            String label,
            DungeonEditorCell cell,
            String direction,
            String description
    ) {

        public RoomExitNarration {
            label = normalizeExitLabel(label);
            cell = normalizeCell(cell);
            direction = normalizeDirection(direction);
            description = normalizeDescription(description);
        }
    }

    private static String normalizeTitle(String title) {
        return title == null || title.isBlank() ? "Dungeon" : title;
    }

    private static String normalizeSummary(String summary) {
        return summary == null ? "" : summary;
    }

    private static List<String> normalizeFacts(List<String> facts) {
        return facts == null ? List.of() : List.copyOf(facts);
    }

    private static List<RoomNarrationCard> normalizeRoomNarrations(List<RoomNarrationCard> roomNarrations) {
        return roomNarrations == null ? List.of() : List.copyOf(roomNarrations);
    }

    private static long normalizeRoomId(long roomId) {
        return Math.max(0L, roomId);
    }

    private static String normalizeRoomName(String roomName) {
        return roomName == null || roomName.isBlank() ? "Raum" : roomName.trim();
    }

    private static String normalizeVisualDescription(String visualDescription) {
        return visualDescription == null ? "" : visualDescription;
    }

    private static List<RoomExitNarration> normalizeExits(List<RoomExitNarration> exits) {
        return exits == null ? List.of() : List.copyOf(exits);
    }

    private static String normalizeExitLabel(String label) {
        return label == null || label.isBlank() ? "Ausgang" : label.trim();
    }

    private static DungeonEditorCell normalizeCell(DungeonEditorCell cell) {
        return cell == null ? new DungeonEditorCell(0, 0, 0) : cell;
    }

    private static String normalizeDirection(String direction) {
        return direction == null || direction.isBlank() ? "NORTH" : direction.trim();
    }

    private static String normalizeDescription(String description) {
        return description == null ? "" : description;
    }
}
