package src.view.mapshared.Model;

import java.util.List;

/**
 * View-local workspace render payload.
 */
public record MapWorkspaceRenderModel(
        String title,
        String subtitle,
        MapWorkspaceTopology topology,
        int width,
        int height,
        List<MapCellViewModel> cells
) {

    public MapWorkspaceRenderModel {
        topology = topology == null ? MapWorkspaceTopology.SQUARE : topology;
        width = Math.max(1, width);
        height = Math.max(1, height);
        cells = cells == null ? List.of() : List.copyOf(cells);
    }
}
