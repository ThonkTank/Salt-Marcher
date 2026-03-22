package features.world.dungeonmap.model.structures.room;

import java.util.List;

public record RoomNarration(
        String visualDescription,
        List<RoomExitNarration> exitNarrations
) {
    private static final RoomNarration EMPTY = new RoomNarration("", List.of());

    public RoomNarration {
        visualDescription = visualDescription == null ? "" : visualDescription.trim();
        exitNarrations = exitNarrations == null ? List.of() : List.copyOf(exitNarrations.stream()
                .filter(java.util.Objects::nonNull)
                .toList());
    }

    public static RoomNarration empty() {
        return EMPTY;
    }
}
