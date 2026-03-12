package features.world.dungeonmap.ui.editor;

import features.world.dungeonmap.model.DungeonEndpoint;
import features.world.dungeonmap.model.DungeonMap;
import features.world.dungeonmap.model.DungeonMapState;
import features.world.dungeonmap.model.DungeonSquare;
import features.world.dungeonmap.ui.editor.dropdowns.DungeonMapFormDropdown;
import javafx.scene.Node;

import java.util.HashSet;
import java.util.Set;
import java.util.function.Consumer;

final class DungeonMapDropdowns {

    private final DungeonMapFormDropdown mapFormDropdown = new DungeonMapFormDropdown();

    void showNewMapDropdown(Node anchor, Consumer<DungeonMapFormDropdown.Result> onCreateRequested) {
        mapFormDropdown.showCreate(anchor, result -> {
            mapFormDropdown.hide();
            onCreateRequested.accept(result);
        });
    }

    void showEditMapDropdown(
            Node anchor,
            DungeonMap map,
            DungeonMapState currentState,
            Consumer<DungeonMapFormDropdown.Result> onUpdateRequested,
            Runnable onDeleteRequested
    ) {
        mapFormDropdown.showEdit(anchor, map,
                (newWidth, newHeight) -> shrinkImpactText(map, currentState, newWidth, newHeight),
                () -> deleteImpactText(map, currentState),
                result -> {
            mapFormDropdown.hide();
            onUpdateRequested.accept(result);
        }, () -> {
            mapFormDropdown.hide();
            onDeleteRequested.run();
        });
    }

    private String shrinkImpactText(DungeonMap map, DungeonMapState currentState, int newWidth, int newHeight) {
        if (newWidth >= map.width() && newHeight >= map.height()) {
            return "";
        }
        ResizeImpact impact = calculateResizeImpact(currentState, newWidth, newHeight);
        return "Dungeon von " + map.width() + "x" + map.height() + " auf "
                + newWidth + "x" + newHeight + " verkleinern?\n"
                + impact.squaresRemoved() + " Felder, "
                + impact.endpointsRemoved() + " Übergänge und "
                + impact.linksRemoved() + " Links werden unwiderruflich gelöscht.\n"
                + "Falls die Gruppe auf einem entfernten Übergang steht, wird ihre Position zurückgesetzt.";
    }

    private ResizeImpact calculateResizeImpact(DungeonMapState currentState, int newWidth, int newHeight) {
        if (currentState == null) {
            return new ResizeImpact(0, 0, 0);
        }
        Set<Long> removedSquareIds = new HashSet<>();
        for (DungeonSquare square : currentState.squares()) {
            if (square.x() >= newWidth || square.y() >= newHeight) {
                removedSquareIds.add(square.squareId());
            }
        }
        Set<Long> removedEndpointIds = new HashSet<>();
        for (DungeonEndpoint endpoint : currentState.endpoints()) {
            if (removedSquareIds.contains(endpoint.squareId())) {
                removedEndpointIds.add(endpoint.endpointId());
            }
        }
        int removedLinks = 0;
        for (var link : currentState.links()) {
            if (removedEndpointIds.contains(link.fromEndpointId()) || removedEndpointIds.contains(link.toEndpointId())) {
                removedLinks++;
            }
        }
        return new ResizeImpact(removedSquareIds.size(), removedEndpointIds.size(), removedLinks);
    }

    private String deleteImpactText(DungeonMap map, DungeonMapState currentState) {
        if (currentState == null) {
            return "Dungeon '" + map.name() + "' unwiderruflich löschen?";
        }
        return "Dungeon '" + map.name() + "' unwiderruflich löschen?\n"
                + currentState.squares().size() + " Felder, "
                + currentState.rooms().size() + " Räume, "
                + currentState.areas().size() + " Bereiche, "
                + currentState.features().size() + " Features, "
                + currentState.endpoints().size() + " Übergänge und "
                + currentState.links().size() + " Links werden entfernt.\n"
                + currentState.passages().size() + " Durchgänge und "
                + currentState.walls().size() + " Wände gehen ebenfalls verloren.";
    }

    private record ResizeImpact(int squaresRemoved, int endpointsRemoved, int linksRemoved) {}
}
