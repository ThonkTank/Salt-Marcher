package features.world.dungeon.application.runtime.description;

import features.world.dungeon.model.interaction.DungeonSelectionRef;

import java.util.List;
import java.util.Objects;

public record DungeonRuntimeDescription(
        String title,
        DungeonSelectionRef ownerRef,
        String description,
        List<DungeonRuntimeExit> exits
) {
    public DungeonRuntimeDescription {
        title = title == null || title.isBlank() ? "Dungeon" : title;
        ownerRef = Objects.requireNonNull(ownerRef, "ownerRef");
        description = description == null ? "" : description.trim();
        exits = exits == null ? List.of() : List.copyOf(exits);
    }
}
