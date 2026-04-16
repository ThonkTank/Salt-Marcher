package src.domain.mapcore.api;

import java.util.List;

/**
 * One immutable render layer on a surface snapshot.
 */
public record MapLayerSnapshot(
        String key,
        String label,
        List<MapCellSnapshot> cells
) {

    public MapLayerSnapshot {
        cells = cells == null ? List.of() : List.copyOf(cells);
    }
}
