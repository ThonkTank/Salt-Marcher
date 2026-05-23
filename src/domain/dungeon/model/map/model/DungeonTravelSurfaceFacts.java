package src.domain.dungeon.model.map.model;

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
        map = defaultMap(map);
        position = defaultPosition(mapId, position);
        areaLabel = displayText(areaLabel, "Kein Standort");
        surfaceTitle = displayText(surfaceTitle, areaLabel);
        tileLabel = cleanText(tileLabel);
        headingLabel = cleanText(headingLabel);
        statusLabel = cleanText(statusLabel);
        visualDescription = cleanText(visualDescription);
        actions = immutableActions(actions);
    }

    @Override
    public List<DungeonTravelActionFacts> actions() {
        return immutableActions(actions);
    }

    private static DungeonMapFacts defaultMap(DungeonMapFacts map) {
        return map == null ? new DungeonMapFacts(DungeonTopology.SQUARE, 1, 1, List.of(), List.of()) : map;
    }

    private static DungeonTravelPositionFacts defaultPosition(
            DungeonMapIdentity mapId,
            DungeonTravelPositionFacts position
    ) {
        return position == null
                ? new DungeonTravelPositionFacts(
                        mapId,
                        DungeonTravelPositionFacts.LocationKind.TILE,
                        0L,
                        new DungeonCell(0, 0, 0),
                        DungeonTravelHeading.defaultHeading())
                : position;
    }

    private static String displayText(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }

    private static String cleanText(String value) {
        return value == null ? "" : value.trim();
    }

    private static List<DungeonTravelActionFacts> immutableActions(List<DungeonTravelActionFacts> actions) {
        return actions == null ? List.of() : List.copyOf(actions);
    }
}
