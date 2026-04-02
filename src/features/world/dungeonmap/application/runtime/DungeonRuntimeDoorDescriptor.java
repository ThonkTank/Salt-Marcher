package features.world.dungeonmap.application.runtime;

import features.world.dungeonmap.application.room.RoomExitDescriptor;
import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.GridSegment2x;
import features.world.dungeonmap.model.structures.connection.ConnectionEndpoint;

public record DungeonRuntimeDoorDescriptor(
        int number,
        String label,
        String destinationLabel,
        int levelZ,
        CellCoord roomCell,
        CellCoord outsideCell,
        CardinalDirection direction,
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
        roomCell = roomCell == null ? new CellCoord(0, 0) : roomCell;
        direction = direction == null ? CardinalDirection.defaultDirection() : direction;
        outsideCell = outsideCell == null ? roomCell.add(direction.delta()) : outsideCell;
        anchorSegment2x = anchorSegment2x == null
                ? GridSegment2x.boundaryEdge(roomCell, direction)
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
        String relativeLabel = resolvedHeading.relativeLabel(exit.direction().delta());
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
