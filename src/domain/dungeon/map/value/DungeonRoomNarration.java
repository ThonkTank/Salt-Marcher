package src.domain.dungeon.map.value;

import java.util.List;

public record DungeonRoomNarration(
        String visualDescription,
        List<DungeonRoomExitDescription> exitDescriptions
) {

    public DungeonRoomNarration {
        visualDescription = visualDescription == null ? "" : visualDescription;
        exitDescriptions = exitDescriptions == null ? List.of() : List.copyOf(exitDescriptions);
    }

    public static DungeonRoomNarration empty() {
        return new DungeonRoomNarration("", List.of());
    }
}
