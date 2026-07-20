package features.hex.api;

public record SaveHexMarkerCommand(
        long mapId,
        long markerId,
        int q,
        int r,
        String name,
        HexMarkerKind type,
        String note
) {
}
