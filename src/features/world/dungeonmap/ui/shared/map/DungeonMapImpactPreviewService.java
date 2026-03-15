package features.world.dungeonmap.ui.shared.map;

import features.world.dungeonmap.model.domain.DungeonMap;
import features.world.dungeonmap.model.domain.DungeonSquare;
import features.world.dungeonmap.model.projection.DungeonMapState;

import java.util.HashSet;
import java.util.Set;

public final class DungeonMapImpactPreviewService {

    public String shrinkImpactText(DungeonMap map, DungeonMapState currentState, int newWidth, int newHeight) {
        if (newWidth >= map.width() && newHeight >= map.height()) {
            return "";
        }
        ResizeImpact impact = calculateResizeImpact(currentState, newWidth, newHeight);
        return "Dungeon von " + map.width() + "x" + map.height() + " auf "
                + newWidth + "x" + newHeight + " verkleinern?\n"
                + impact.squaresRemoved() + " Felder und "
                + impact.connectionsRemoved() + " Verbindungen werden unwiderruflich gelöscht.\n"
                + "Falls die Gruppe auf einem entfernten Feld steht, wird ihre Position zurückgesetzt.";
    }

    public String deleteImpactText(DungeonMap map, DungeonMapState currentState) {
        if (currentState == null) {
            return "Dungeon '" + map.name() + "' unwiderruflich löschen?";
        }
        return "Dungeon '" + map.name() + "' unwiderruflich löschen?\n"
                + currentState.squares().size() + " Felder, "
                + currentState.rooms().size() + " Räume, "
                + currentState.areas().size() + " Bereiche, "
                + currentState.features().size() + " Features und "
                + currentState.connections().size() + " Verbindungen werden entfernt.\n"
                + currentState.wallEdgeCount() + " Wände gehen ebenfalls verloren.";
    }

    private ResizeImpact calculateResizeImpact(DungeonMapState currentState, int newWidth, int newHeight) {
        if (currentState == null) {
            return new ResizeImpact(0, 0);
        }
        Set<Long> removedSquareIds = new HashSet<>();
        for (DungeonSquare square : currentState.squares()) {
            if (square.x() >= newWidth || square.y() >= newHeight) {
                removedSquareIds.add(square.squareId());
            }
        }
        int removedConnections = 0;
        for (var connectionPath : currentState.roomConnections()) {
            boolean removed = connectionPath.routePoints().stream()
                    .anyMatch(point -> point.x() >= newWidth || point.y() >= newHeight);
            if (removed) {
                removedConnections += 1;
            }
        }
        return new ResizeImpact(removedSquareIds.size(), removedConnections);
    }

    private record ResizeImpact(int squaresRemoved, int connectionsRemoved) {}
}
