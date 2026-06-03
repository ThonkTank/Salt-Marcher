package src.domain.dungeon.model.runtime.travel.projection;


import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionSurface;

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

    public @Nullable TravelActionFacts action(String actionId) {
        String requestedActionId = actionId == null ? "" : actionId.trim();
        for (TravelActionFacts candidate : actions) {
            if (candidate.actionId().equals(requestedActionId)) {
                return candidate;
            }
        }
        return null;
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
                        TravelPositionFacts.LocationKind.TILE,
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
