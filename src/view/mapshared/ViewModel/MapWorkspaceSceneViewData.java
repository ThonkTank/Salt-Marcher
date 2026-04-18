package src.view.mapshared.ViewModel;

import java.util.List;

/**
 * View-local scene payload used by the shared map workspace.
 */
public record MapWorkspaceSceneViewData(
        String topology,
        List<MapCellViewModel> cells,
        List<MapEdgeViewModel> edges
) {

    public MapWorkspaceSceneViewData {
        topology = topology == null || topology.isBlank() ? "SQUARE" : topology;
        cells = cells == null ? List.of() : List.copyOf(cells);
        edges = edges == null ? List.of() : List.copyOf(edges);
    }

    public static MapWorkspaceSceneViewData empty() {
        return new MapWorkspaceSceneViewData("SQUARE", List.of(), List.of());
    }
}
