package src.domain.dungeon.published;

import java.util.List;

public record DungeonTravelSurfaceSnapshot(
        String mapName,
        int revision,
        DungeonMapSnapshot map,
        DungeonTravelPosition position,
        String surfaceTitle,
        String areaLabel,
        String tileLabel,
        String headingLabel,
        String statusLabel,
        String visualDescription,
        List<DungeonTravelActionSnapshot> actions
) {

    public DungeonTravelSurfaceSnapshot {
        mapName = mapName == null || mapName.isBlank() ? "Dungeon" : mapName.trim();
        revision = Math.max(0, revision);
        map = map == null ? DungeonMapSnapshot.empty() : map;
        position = position == null ? new DungeonTravelPosition(null, null, 0L, null, null) : position;
        surfaceTitle = surfaceTitle == null || surfaceTitle.isBlank() ? areaLabel : surfaceTitle.trim();
        areaLabel = areaLabel == null || areaLabel.isBlank() ? "Kein Standort" : areaLabel.trim();
        tileLabel = tileLabel == null ? "" : tileLabel.trim();
        headingLabel = headingLabel == null ? "" : headingLabel.trim();
        statusLabel = statusLabel == null ? "" : statusLabel.trim();
        visualDescription = visualDescription == null ? "" : visualDescription.trim();
        actions = actions == null ? List.of() : List.copyOf(actions);
    }
}
