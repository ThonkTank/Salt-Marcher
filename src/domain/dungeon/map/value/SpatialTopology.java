package src.domain.dungeon.map.value;

/**
 * Minimal authored spatial truth for the current dungeon parity foundation.
 *
 * <p>The full topology model will grow around rooms, clusters, corridors,
 * stairs, and transitions. These seed facts keep the existing surfaces
 * functional while the legacy behavior is moved behind the aggregate
 * boundary.</p>
 */
public record SpatialTopology(
        DungeonTopology topology,
        int width,
        int height,
        int roomAnchorQ,
        int roomAnchorR
) {

    public SpatialTopology {
        topology = topology == null ? DungeonTopology.SQUARE : topology;
        width = Math.max(6, width);
        height = Math.max(6, height);
        roomAnchorQ = Math.max(1, Math.min(width - 4, roomAnchorQ));
        roomAnchorR = Math.max(1, Math.min(height - 4, roomAnchorR));
    }

    public static SpatialTopology empty() {
        return demo();
    }

    public static SpatialTopology demo() {
        return new SpatialTopology(DungeonTopology.SQUARE, 10, 8, 2, 2);
    }

    public SpatialTopology moveRoomAnchor(int deltaQ, int deltaR) {
        return new SpatialTopology(
                topology,
                width,
                height,
                roomAnchorQ + deltaQ,
                roomAnchorR + deltaR);
    }
}
