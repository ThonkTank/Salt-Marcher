package features.world.dungeonmap.application.runtime.description;

import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.GridSegment2x;

import java.util.Objects;

public record DungeonRuntimeExit(
        String label,
        int number,
        GridSegment2x anchorSegment2x,
        String destinationLabel,
        String description,
        CellCoord destinationCell,
        int destinationLevelZ,
        CardinalDirection destinationHeading
) {
    public DungeonRuntimeExit {
        label = label == null ? "" : label.trim();
        number = number <= 0 ? 1 : number;
        anchorSegment2x = Objects.requireNonNull(anchorSegment2x, "anchorSegment2x");
        destinationLabel = destinationLabel == null ? "" : destinationLabel.trim();
        description = description == null ? "" : description.trim();
        destinationCell = Objects.requireNonNull(destinationCell, "destinationCell");
        destinationHeading = Objects.requireNonNull(destinationHeading, "destinationHeading");
    }
}
