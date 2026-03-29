package features.world.dungeonmap.model.structures.traversal;

import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.structures.room.Room;

import java.util.List;

public record TraversalSplitRewriteInput(
        Long originalRoomId,
        List<Room> fragments,
        List<Point2i> connectedRoomCenters
) {
    public TraversalSplitRewriteInput {
        fragments = fragments == null ? List.of() : List.copyOf(fragments);
        connectedRoomCenters = connectedRoomCenters == null ? List.of() : List.copyOf(connectedRoomCenters);
    }

    public boolean isUsableFor(Traversal traversal) {
        return traversal != null
                && originalRoomId != null
                && !fragments.isEmpty()
                && traversal.connectsRoom(originalRoomId);
    }
}
