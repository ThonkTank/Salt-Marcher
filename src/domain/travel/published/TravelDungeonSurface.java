package src.domain.travel.published;

import java.util.List;

public record TravelDungeonSurface(
        ContextKind contextKind,
        String mapName,
        int revision,
        TravelDungeonMapSnapshot map,
        TravelDungeonPosition position,
        String surfaceTitle,
        String areaLabel,
        String tileLabel,
        String headingLabel,
        String statusLabel,
        String visualDescription,
        List<TravelDungeonAction> actions
) {

    public TravelDungeonSurface {
        contextKind = contextKind == null ? ContextKind.DUNGEON : contextKind;
        mapName = mapName == null || mapName.isBlank() ? "Dungeon" : mapName.trim();
        revision = Math.max(0, revision);
        map = map == null ? TravelDungeonMapSnapshot.empty() : map;
        position = position == null
                ? new TravelDungeonPosition(1L, TravelDungeonPosition.LocationKind.TILE, 0L, new TravelDungeonCell(0, 0, 0), TravelDungeonPosition.Heading.SOUTH)
                : position;
        surfaceTitle = surfaceTitle == null || surfaceTitle.isBlank() ? mapName : surfaceTitle.trim();
        areaLabel = areaLabel == null || areaLabel.isBlank() ? "Kein Standort" : areaLabel.trim();
        tileLabel = tileLabel == null ? "" : tileLabel.trim();
        headingLabel = headingLabel == null ? "" : headingLabel.trim();
        statusLabel = statusLabel == null ? "" : statusLabel.trim();
        visualDescription = visualDescription == null ? "" : visualDescription.trim();
        actions = actions == null ? List.of() : List.copyOf(actions);
    }

    public enum ContextKind {
        DUNGEON,
        OVERWORLD
    }
}
