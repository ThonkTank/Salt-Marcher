package src.view.mapcanvas.api;

import java.util.List;

/**
 * View-local scene payload used by the shared map workspace.
 */
public record MapCanvasScene(
        String topology,
        List<MapCanvasCell> cells,
        List<MapCanvasEdge> edges
) {

    public MapCanvasScene {
        topology = topology == null || topology.isBlank() ? "SQUARE" : topology;
        cells = cells == null ? List.of() : List.copyOf(cells);
        edges = edges == null ? List.of() : List.copyOf(edges);
    }

    public static MapCanvasScene empty() {
        return new MapCanvasScene("SQUARE", List.of(), List.of());
    }
}
