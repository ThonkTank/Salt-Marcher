package src.domain.dungeon.entity;

import src.domain.mapcore.api.MapTopologyKind;

/**
 * Committed editable dungeon truth.
 */
public record DungeonDocument(
        String mapName,
        MapTopologyKind topology,
        int width,
        int height,
        int roomAnchorQ,
        int roomAnchorR,
        int revision
) {

    public DungeonDocument {
        mapName = mapName == null || mapName.isBlank() ? "Dungeon Bastion" : mapName;
        topology = topology == null ? MapTopologyKind.SQUARE : topology;
        width = Math.max(6, width);
        height = Math.max(6, height);
        revision = Math.max(0, revision);
    }

    public static DungeonDocument demo() {
        return new DungeonDocument("Dungeon Bastion", MapTopologyKind.SQUARE, 10, 8, 2, 2, 1);
    }

    public DungeonDocument moveRoomAnchor(int deltaQ, int deltaR) {
        int nextQ = Math.max(1, Math.min(width - 4, roomAnchorQ + deltaQ));
        int nextR = Math.max(1, Math.min(height - 4, roomAnchorR + deltaR));
        return new DungeonDocument(mapName, topology, width, height, nextQ, nextR, revision + 1);
    }
}
