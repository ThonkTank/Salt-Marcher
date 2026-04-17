package src.domain.mapcore.api;

import java.util.List;

/**
 * Transport-neutral viewport payload used by dungeon map snapshots.
 */
public record MapRenderPayload(
        MapTopologyKind topology,
        List<MapCellSnapshot> cells,
        List<MapEdgeSnapshot> edges
) {

    public MapRenderPayload {
        topology = topology == null ? MapTopologyKind.SQUARE : topology;
        cells = cells == null ? List.of() : List.copyOf(cells);
        edges = edges == null ? List.of() : List.copyOf(edges);
    }

    public static MapRenderPayload empty() {
        return new MapRenderPayload(MapTopologyKind.SQUARE, List.of(), List.of());
    }
}
