package features.world.dungeonmap.application.runtime.description;

import features.world.dungeonmap.application.runtime.DungeonRuntimeAction;
import features.world.dungeonmap.model.geometry.GridSegment2x;

import java.util.Objects;

public record DungeonRuntimeExit(
        int number,
        GridSegment2x anchorSegment2x,
        String destinationLabel,
        String description,
        DungeonRuntimeAction action
) {
    public DungeonRuntimeExit {
        number = number <= 0 ? 1 : number;
        anchorSegment2x = Objects.requireNonNull(anchorSegment2x, "anchorSegment2x");
        destinationLabel = destinationLabel == null ? "" : destinationLabel.trim();
        description = description == null ? "" : description.trim();
        action = Objects.requireNonNull(action, "action");
    }
}
