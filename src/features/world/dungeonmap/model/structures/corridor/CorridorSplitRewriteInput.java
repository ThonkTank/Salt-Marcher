package features.world.dungeonmap.model.structures.corridor;

import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.structures.room.Room;

import java.util.List;

/**
 * Minimal corridor-local decision input for room-split rewrites.
 *
 * <p>The corridor should decide which fragment replaces a split source room without depending on full layout state
 * or application-layer heuristics. This input carries only the facts needed for that local decision: the original
 * room id, candidate fragments, and the resolved centers of the other rooms already connected by this corridor.</p>
 */
public record CorridorSplitRewriteInput(
        Long originalRoomId,
        List<Room> fragments,
        List<Point2i> connectedRoomCenters
) {
    public CorridorSplitRewriteInput {
        fragments = fragments == null ? List.of() : List.copyOf(fragments);
        connectedRoomCenters = connectedRoomCenters == null ? List.of() : List.copyOf(connectedRoomCenters);
    }

    public boolean isUsableFor(Corridor corridor) {
        return corridor != null
                && originalRoomId != null
                && !fragments.isEmpty()
                && corridor.connectsRoom(originalRoomId);
    }
}
