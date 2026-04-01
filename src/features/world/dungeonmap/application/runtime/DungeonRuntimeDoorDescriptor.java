package features.world.dungeonmap.application.runtime;

import features.world.dungeonmap.application.room.RoomExitDescriptor;
import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.GridSegment2x;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.structures.connection.ConnectionEndpoint;

public record DungeonRuntimeDoorDescriptor(
        int number,
        String label,
        String destinationLabel,
        int levelZ,
        Point2i roomCell,
        Point2i outsideCell,
        Point2i direction,
        GridSegment2x anchorSegment2x,
        ConnectionEndpoint activeEndpoint,
        ConnectionEndpoint destinationEndpoint,
        String relativeLabel,
        String description
) {
    public DungeonRuntimeDoorDescriptor {
        number = number <= 0 ? 1 : number;
        label = label == null || label.isBlank() ? "Tür " + number : label;
        destinationLabel = destinationLabel == null ? "" : destinationLabel.trim();
        levelZ = levelZ;
        roomCell = roomCell == null ? new Point2i(0, 0) : roomCell;
        direction = direction == null ? new Point2i(0, -1) : direction;
        outsideCell = outsideCell == null ? roomCell.add(direction) : outsideCell;
        anchorSegment2x = anchorSegment2x == null
                ? GridSegment2x.betweenCellAndStep(roomCell, direction)
                : anchorSegment2x;
        relativeLabel = relativeLabel == null || relativeLabel.isBlank() ? "Direkt vor euch" : relativeLabel;
        description = description == null || description.isBlank() ? describe(relativeLabel, "eine Tür") : description;
    }

    public static DungeonRuntimeDoorDescriptor from(
            RoomExitDescriptor exit,
            CardinalDirection heading,
            ConnectionEndpoint activeEndpoint,
            ConnectionEndpoint destinationEndpoint,
            String destinationLabel,
            String narration
    ) {
        CardinalDirection resolvedHeading = heading == null ? CardinalDirection.defaultDirection() : heading;
        String relativeLabel = resolvedHeading.relativeLabel(exit.direction());
        String resolvedNarration = narration == null ? "" : narration.trim();
        String description = describe(relativeLabel, resolvedNarration.isBlank() ? "eine Tür" : resolvedNarration);
        return new DungeonRuntimeDoorDescriptor(
                exit.number(),
                exit.label(),
                destinationLabel,
                exit.levelZ(),
                exit.roomCell(),
                exit.outsideCell(),
                exit.direction(),
                exit.anchorSegment2x(),
                activeEndpoint,
                destinationEndpoint,
                relativeLabel,
                description);
    }

    public String displayLabel() {
        return destinationLabel.isBlank() ? label : label + ": " + destinationLabel;
    }

    private static String describe(String relativeLabel, String subject) {
        return relativeLabel + " ist " + subject;
    }
}
