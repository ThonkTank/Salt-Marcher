package features.dungeon.application.travel.projection;


import java.util.List;
import java.util.Optional;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.api.DungeonTravelActionId;
import features.dungeon.application.travel.session.TravelDungeonSessionSurface;
import features.dungeon.application.travel.session.TravelDungeonSessionSurface.LocationKind;

public record TravelSurfaceFacts(
        long mapId,
        String mapName,
        long revision,
        TravelDungeonSessionSurface.MapData map,
        TravelPositionFacts position,
        String surfaceTitle,
        String areaLabel,
        String tileLabel,
        String headingLabel,
        String statusLabel,
        String visualDescription,
        List<TravelActionFacts> actions
) {

    public TravelSurfaceFacts {
        mapId = Math.max(1L, mapId);
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
    public List<TravelActionFacts> actions() {
        return immutableActions(actions);
    }

    public Optional<TravelActionFacts> action(DungeonTravelActionId actionId) {
        if (actionId == null) {
            return Optional.empty();
        }
        return actions.stream()
                .filter(action -> actionId.equals(action.actionId()))
                .findFirst();
    }

    private static TravelDungeonSessionSurface.MapData defaultMap(TravelDungeonSessionSurface.MapData map) {
        return map == null ? TravelDungeonSessionSurface.MapData.empty() : map;
    }

    private static TravelPositionFacts defaultPosition(
            long mapId,
            TravelPositionFacts position
    ) {
        return position == null
                ? new TravelPositionFacts(
                        mapId,
                        LocationKind.TILE,
                        0L,
                        new Cell(0, 0, 0),
                        TravelHeading.defaultHeading())
                : position;
    }

    private static String displayText(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }

    private static String cleanText(String value) {
        return value == null ? "" : value.trim();
    }

    private static List<TravelActionFacts> immutableActions(List<TravelActionFacts> actions) {
        return actions == null ? List.of() : List.copyOf(actions);
    }
}
