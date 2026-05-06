package src.domain.travel.published;

import java.util.List;

public record TravelDungeonWorkspaceState(
        String mapName,
        String areaLabel,
        String tileLabel,
        String headingLabel,
        String statusLabel,
        boolean outsideDungeon,
        List<TravelDungeonAction> actions
) {

    public TravelDungeonWorkspaceState {
        mapName = mapName == null || mapName.isBlank() ? "Dungeon" : mapName.trim();
        areaLabel = areaLabel == null || areaLabel.isBlank() ? "Kein Standort" : areaLabel.trim();
        tileLabel = tileLabel == null ? "" : tileLabel.trim();
        headingLabel = headingLabel == null ? "" : headingLabel.trim();
        statusLabel = statusLabel == null ? "" : statusLabel.trim();
        actions = actions == null ? List.of() : List.copyOf(actions);
    }

    @Override
    public List<TravelDungeonAction> actions() {
        return List.copyOf(actions);
    }
}
