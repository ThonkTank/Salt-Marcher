package src.data.dungeon.model;

import java.util.List;

/**
 * Source-local dungeon map catalog row.
 */
public record DungeonMapRecord(
        long mapId,
        String name,
        long revision,
        DungeonGridBoundsRecord gridBounds,
        List<DungeonRoomClusterRecord> roomClusters,
        List<DungeonRoomRecord> rooms,
        List<DungeonTopologyElementRecord> topologyElements,
        List<DungeonCorridorRecord> corridors,
        List<DungeonStairRecord> stairs,
        List<DungeonTransitionRecord> transitions,
        List<DungeonFeatureMarkerRecord> featureMarkers
) {

    public DungeonMapRecord(
            long mapId,
            String name,
            long revision,
            DungeonGridBoundsRecord gridBounds
    ) {
        this(mapId, name, revision, gridBounds, List.of(), List.of(), List.of(), List.of(), List.of(), List.of(),
                List.of());
    }

    public DungeonMapRecord {
        name = name == null || name.isBlank() ? "Dungeon " + mapId : name.trim();
        revision = Math.max(1L, revision);
        gridBounds = gridBounds == null ? DungeonGridBoundsRecord.defaultGrid() : gridBounds;
        roomClusters = roomClusters == null ? List.of() : List.copyOf(roomClusters);
        rooms = rooms == null ? List.of() : List.copyOf(rooms);
        topologyElements = topologyElements == null ? List.of() : List.copyOf(topologyElements);
        corridors = corridors == null ? List.of() : List.copyOf(corridors);
        stairs = stairs == null ? List.of() : List.copyOf(stairs);
        transitions = transitions == null ? List.of() : List.copyOf(transitions);
        featureMarkers = featureMarkers == null ? List.of() : List.copyOf(featureMarkers);
    }
}
