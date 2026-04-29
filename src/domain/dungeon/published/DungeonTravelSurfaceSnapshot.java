package src.domain.dungeon.published;

import java.util.List;

public record DungeonTravelSurfaceSnapshot(
        DungeonTravelContextKind contextKind,
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
        contextKind = contextKind == null ? DungeonTravelContextKind.DUNGEON : contextKind;
        mapName = mapName == null || mapName.isBlank() ? "Dungeon" : mapName.trim();
        revision = Math.max(0, revision);
        map = map == null ? DungeonMapSnapshot.empty() : map;
        position = position == null
                ? new DungeonTravelPosition(
                        new DungeonMapId(1L),
                        DungeonTravelLocationKind.TILE,
                        0L,
                        new DungeonCellRef(0, 0, 0),
                        DungeonTravelHeading.defaultHeading())
                : position;
        areaLabel = areaLabel == null || areaLabel.isBlank() ? "Kein Standort" : areaLabel.trim();
        surfaceTitle = surfaceTitle == null || surfaceTitle.isBlank() ? areaLabel : surfaceTitle.trim();
        tileLabel = tileLabel == null ? "" : tileLabel.trim();
        headingLabel = headingLabel == null ? "" : headingLabel.trim();
        statusLabel = statusLabel == null ? "" : statusLabel.trim();
        visualDescription = visualDescription == null ? "" : visualDescription.trim();
        actions = actions == null ? List.of() : List.copyOf(actions);
    }
}
