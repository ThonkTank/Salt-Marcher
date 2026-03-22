package features.world.dungeonmap.application.runtime;

import features.world.dungeonmap.application.room.RoomExitDescriptor;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.VertexEdge;

public record DungeonRuntimeDoorDescriptor(
        int number,
        String label,
        Point2i roomCell,
        Point2i outsideCell,
        Point2i direction,
        VertexEdge anchorEdge,
        String relativeLabel,
        String description
) {
    public DungeonRuntimeDoorDescriptor {
        number = number <= 0 ? 1 : number;
        label = label == null || label.isBlank() ? "Tuer " + number : label;
        roomCell = roomCell == null ? new Point2i(0, 0) : roomCell;
        direction = direction == null ? new Point2i(0, -1) : direction;
        outsideCell = outsideCell == null ? roomCell.add(direction) : outsideCell;
        anchorEdge = anchorEdge == null ? VertexEdge.betweenCellAndStep(roomCell, direction) : anchorEdge;
        relativeLabel = relativeLabel == null || relativeLabel.isBlank() ? "Direkt vor euch" : relativeLabel;
        description = description == null || description.isBlank() ? relativeLabel + " ist eine Tuer." : description;
    }

    public static DungeonRuntimeDoorDescriptor from(RoomExitDescriptor exit, DungeonHeading heading, String narration) {
        DungeonHeading resolvedHeading = heading == null ? DungeonHeading.defaultHeading() : heading;
        String relativeLabel = resolvedHeading.relativeLabel(exit.direction());
        String baseDescription = relativeLabel + " ist eine Tuer.";
        String resolvedNarration = narration == null ? "" : narration.trim();
        String description = resolvedNarration.isBlank() ? baseDescription : baseDescription + " " + resolvedNarration;
        return new DungeonRuntimeDoorDescriptor(
                exit.number(),
                exit.label(),
                exit.roomCell(),
                exit.outsideCell(),
                exit.direction(),
                exit.anchorEdge(),
                relativeLabel,
                description);
    }
}
