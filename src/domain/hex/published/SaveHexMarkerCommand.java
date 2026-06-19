package src.domain.hex.published;

public record SaveHexMarkerCommand(
        long mapId,
        long markerId,
        int q,
        int r,
        String name,
        String type,
        String note
) {
}
