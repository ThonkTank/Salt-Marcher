package src.view.mapcanvas.api;

import java.util.List;
import javafx.scene.Node;

public record MapCanvasLayers(
        List<Node> belowGrid,
        List<Node> belowContent,
        List<Node> aboveContent,
        List<Node> selectionOverlay,
        List<Node> actorOverlay,
        List<Node> toolOverlay,
        List<Node> hudOverlay
) {

    public MapCanvasLayers {
        belowGrid = immutableNodes(belowGrid);
        belowContent = immutableNodes(belowContent);
        aboveContent = immutableNodes(aboveContent);
        selectionOverlay = immutableNodes(selectionOverlay);
        actorOverlay = immutableNodes(actorOverlay);
        toolOverlay = immutableNodes(toolOverlay);
        hudOverlay = immutableNodes(hudOverlay);
    }

    public static MapCanvasLayers empty() {
        return new MapCanvasLayers(List.of(), List.of(), List.of(), List.of(), List.of(), List.of(), List.of());
    }

    public boolean hasContent() {
        return !belowGrid.isEmpty()
                || !belowContent.isEmpty()
                || !aboveContent.isEmpty()
                || !selectionOverlay.isEmpty()
                || !actorOverlay.isEmpty()
                || !toolOverlay.isEmpty()
                || !hudOverlay.isEmpty();
    }

    private static List<Node> immutableNodes(List<Node> nodes) {
        return nodes == null ? List.of() : List.copyOf(nodes);
    }
}
