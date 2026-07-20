package features.hex.adapter.sqlite.model;

public record HexMarkerRecord(
        long mapId,
        long markerId,
        int q,
        int r,
        String name,
        String markerType,
        String note
) {
}
