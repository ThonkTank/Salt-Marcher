package features.hex.adapter.sqlite.model;

import java.util.List;

public record HexMapSnapshotRecord(
        HexMapRecord map,
        List<HexTileRecord> tiles,
        List<HexTerrainOverrideRecord> terrainOverrides,
        List<HexMarkerRecord> markers
) {

    public HexMapSnapshotRecord {
        tiles = tiles == null ? List.of() : List.copyOf(tiles);
        terrainOverrides = terrainOverrides == null ? List.of() : List.copyOf(terrainOverrides);
        markers = markers == null ? List.of() : List.copyOf(markers);
    }
}
