package src.view.leftbartabs.dungeontravel;

import src.domain.travel.published.TravelDungeonWorkspaceState;

final class DungeonTravelStateTextFormatter {

    private DungeonTravelStateTextFormatter() {
    }

    static String defaultState(int projectionLevel, DungeonTravelOverlayProjection overlayProjection) {
        return "Position: " + DungeonTravelUiText.NO_LOCATION_LABEL + "\n"
                + "Tile: z=" + projectionLevel + "\n"
                + "Heading: " + DungeonTravelUiText.DEFAULT_HEADING_LABEL + "\n"
                + "Status: " + DungeonTravelUiText.DEFAULT_STATUS_LABEL + "\n"
                + overlayProjection.overlayLabel();
    }

    static String fromWorkspaceState(
            TravelDungeonWorkspaceState workspaceState,
            DungeonTravelOverlayProjection overlayProjection
    ) {
        if (workspaceState == null) {
            return defaultState(0, overlayProjection);
        }
        return "Position: " + workspaceState.areaLabel() + "\n"
                + "Tile: " + workspaceState.tileLabel() + "\n"
                + "Heading: " + workspaceState.headingLabel() + "\n"
                + "Status: " + statusLabel(workspaceState) + "\n"
                + overlayProjection.overlayLabel();
    }

    private static String statusLabel(TravelDungeonWorkspaceState workspaceState) {
        if (!workspaceState.statusLabel().isBlank()) {
            return workspaceState.statusLabel();
        }
        return workspaceState.outsideDungeon()
                ? DungeonTravelUiText.OUTSIDE_DUNGEON_STATUS
                : DungeonTravelUiText.DEFAULT_STATUS_LABEL;
    }
}
