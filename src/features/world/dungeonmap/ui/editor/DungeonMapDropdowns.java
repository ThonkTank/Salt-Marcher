package features.world.dungeonmap.ui.editor;

import features.world.dungeonmap.model.DungeonEndpoint;
import features.world.dungeonmap.model.DungeonLinkAnchorType;
import features.world.dungeonmap.model.DungeonMap;
import features.world.dungeonmap.model.DungeonMapState;
import features.world.dungeonmap.model.DungeonPassage;
import features.world.dungeonmap.model.DungeonSquare;
import features.world.dungeonmap.ui.editor.dropdowns.DungeonMapFormDropdown;
import javafx.scene.Node;

import java.util.HashSet;
import java.util.Set;
import java.util.function.Consumer;

public final class DungeonMapDropdowns {

    private final DungeonMapFormDropdown mapFormDropdown = new DungeonMapFormDropdown();

    public void showNewMapDropdown(Node anchor, Consumer<DungeonMapFormDropdown.Result> onCreateRequested) {
        mapFormDropdown.showCreate(anchor, result -> {
            mapFormDropdown.hide();
            onCreateRequested.accept(result);
        });
    }

    public void showEditMapDropdown(
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
        Set<Long> removedPassageIds = new HashSet<>();
        for (DungeonPassage passage : currentState.passages()) {
            DungeonSquare primary = findSquare(currentState, passage.x(), passage.y());
            DungeonSquare adjacent = switch (passage.direction()) {
                case EAST -> findSquare(currentState, passage.x() + 1, passage.y());
                case SOUTH -> findSquare(currentState, passage.x(), passage.y() + 1);
            };
            boolean primaryRemoved = primary != null && removedSquareIds.contains(primary.squareId());
            boolean adjacentRemoved = adjacent != null && removedSquareIds.contains(adjacent.squareId());
            if (primaryRemoved || adjacentRemoved) {
                removedPassageIds.add(passage.passageId());
            }
        }
        int removedLinks = 0;
        for (var link : currentState.links()) {
            if (touchesRemovedAnchor(link.fromAnchor(), removedEndpointIds, removedPassageIds)
                    || touchesRemovedAnchor(link.toAnchor(), removedEndpointIds, removedPassageIds)) {
                removedLinks++;
            }
        }
        return new ResizeImpact(removedSquareIds.size(), removedEndpointIds.size(), removedLinks);
    }

    private DungeonSquare findSquare(DungeonMapState currentState, int x, int y) {
        if (currentState == null) {
            return null;
        }
        for (DungeonSquare square : currentState.squares()) {
            if (square.x() == x && square.y() == y) {
                return square;
            }
        }
        return null;
    }

    private boolean touchesRemovedAnchor(
            features.world.dungeonmap.model.DungeonLinkAnchor anchor,
            Set<Long> removedEndpointIds,
            Set<Long> removedPassageIds
    ) {
        if (anchor == null) {
            return false;
        }
        if (anchor.type() == DungeonLinkAnchorType.ENDPOINT) {
            return removedEndpointIds.contains(anchor.anchorId());
        }
        return removedPassageIds.contains(anchor.anchorId());
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
                + currentState.passageEdgeCount() + " Durchgänge und "
                + currentState.wallEdgeCount() + " Wände gehen ebenfalls verloren.";
    }

    private record ResizeImpact(int squaresRemoved, int endpointsRemoved, int linksRemoved) {}
}
