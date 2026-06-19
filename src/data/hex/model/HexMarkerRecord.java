package src.data.hex.model;

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
