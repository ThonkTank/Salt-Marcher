package src.domain.dungeon.map.value;

import java.util.List;

public record DungeonTravelSurfaceFacts(
        DungeonMapIdentity mapId,
        String mapName,
        long revision,
        DungeonMapFacts map,
        DungeonTravelPositionFacts position,
        String surfaceTitle,
        String areaLabel,
        String tileLabel,
        String headingLabel,
        String statusLabel,
        String visualDescription,
        List<DungeonTravelActionFacts> actions
) {

    public DungeonTravelSurfaceFacts {
        mapId = mapId == null ? new DungeonMapIdentity(1L) : mapId;
        mapName = mapName == null || mapName.isBlank() ? "Dungeon" : mapName.trim();
        revision = Math.max(0L, revision);
        map = map == null ? new DungeonMapFacts(DungeonTopology.SQUARE, 1, 1, List.of(), List.of()) : map;
        position = position == null
                ? new DungeonTravelPositionFacts(mapId, DungeonTravelLocationKind.TILE, 0L, new DungeonCell(0, 0, 0), DungeonTravelHeading.defaultHeading())
                : position;
        surfaceTitle = surfaceTitle == null || surfaceTitle.isBlank() ? areaLabel : surfaceTitle.trim();
        areaLabel = areaLabel == null || areaLabel.isBlank() ? "Kein Standort" : areaLabel.trim();
        tileLabel = tileLabel == null ? "" : tileLabel.trim();
        headingLabel = headingLabel == null ? "" : headingLabel.trim();
        statusLabel = statusLabel == null ? "" : statusLabel.trim();
        visualDescription = visualDescription == null ? "" : visualDescription.trim();
        actions = actions == null ? List.of() : List.copyOf(actions);
    }
}
