package src.domain.mapcore.api;

import java.util.Comparator;
import java.util.List;

/**
 * Immutable surface contract reused by editor and runtime map views.
 */
public record MapSurfaceSnapshot(
        String mapName,
        MapTopologyKind topology,
        int width,
        int height,
        List<MapLayerSnapshot> layers,
        List<MapEdgeSnapshot> edges,
        List<MapSelectionRef> selectableTargets
) {

    public MapSurfaceSnapshot {
        mapName = mapName == null || mapName.isBlank() ? "Untitled Map" : mapName;
        topology = topology == null ? MapTopologyKind.SQUARE : topology;
        width = Math.max(1, width);
        height = Math.max(1, height);
        layers = layers == null ? List.of() : List.copyOf(layers);
        edges = edges == null ? List.of() : List.copyOf(edges);
        selectableTargets = selectableTargets == null ? List.of() : List.copyOf(selectableTargets);
    }

    public static MapSurfaceSnapshot empty() {
        return new MapSurfaceSnapshot("Empty Map", MapTopologyKind.SQUARE, 1, 1, List.of(), List.of(), List.of());
    }

    public List<MapCellSnapshot> allCells() {
        return layers.stream()
                .flatMap(layer -> layer.cells().stream())
                .sorted(Comparator
                        .comparingInt((MapCellSnapshot cell) -> cell.ref().level())
                        .thenComparingInt(cell -> cell.ref().r())
                        .thenComparingInt(cell -> cell.ref().q())
                        .thenComparing(MapCellSnapshot::label, Comparator.nullsLast(String::compareToIgnoreCase)))
                .toList();
    }
}
