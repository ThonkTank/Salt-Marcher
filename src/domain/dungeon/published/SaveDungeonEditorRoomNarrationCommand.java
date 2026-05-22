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

    public SaveDungeonEditorRoomNarrationCommand(
            long roomId,
            String visualDescription,
            List<String> labels,
            List<Integer> qs,
            List<Integer> rs,
            List<Integer> levels,
            List<String> directions,
            List<String> descriptions
    ) {
        this(roomId, visualDescription, exits(labels, qs, rs, levels, directions, descriptions));
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

    private static List<ExitNarration> exits(
            List<String> labels,
            List<Integer> qs,
            List<Integer> rs,
            List<Integer> levels,
            List<String> directions,
            List<String> descriptions
    ) {
        int size = maxSize(labels, qs, rs, levels, directions, descriptions);
        java.util.ArrayList<ExitNarration> result = new java.util.ArrayList<>(size);
        for (int index = 0; index < size; index++) {
            result.add(new ExitNarration(
                    textAt(labels, index),
                    intAt(qs, index),
                    intAt(rs, index),
                    intAt(levels, index),
                    textAt(directions, index),
                    textAt(descriptions, index)));
        }
        return List.copyOf(result);
    }

    private static int maxSize(List<?>... lists) {
        int size = 0;
        for (List<?> list : lists) {
            if (list != null && list.size() > size) {
                size = list.size();
            }
        }
        return size;
    }

    private static String textAt(List<String> values, int index) {
        return values == null || index < 0 || index >= values.size() ? "" : values.get(index);
    }

    private static int intAt(List<Integer> values, int index) {
        Integer value = values == null || index < 0 || index >= values.size() ? null : values.get(index);
        return value == null ? 0 : value;
    }
}
