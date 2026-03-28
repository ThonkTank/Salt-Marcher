package features.world.dungeonmap.model.structures.traversal.planning.internal;

import java.util.Objects;

public record TraversalNodeId(String value) {

    public TraversalNodeId {
        Objects.requireNonNull(value, "value");
        value = value.trim();
        if (value.isEmpty()) {
            throw new IllegalArgumentException("value must not be blank");
        }
    }

    public static TraversalNodeId roomPortal(Long roomId, int levelZ, int roomIndex) {
        if (roomId != null) {
            return new TraversalNodeId("portal:room:" + roomId + ":z:" + levelZ);
        }
        return new TraversalNodeId("portal:index:" + Math.max(roomIndex, 0) + ":z:" + levelZ);
    }

    public static TraversalNodeId waypoint(int index) {
        return new TraversalNodeId("waypoint:" + Math.max(index, 0));
    }

    @Override
    public String toString() {
        return value;
    }
}
