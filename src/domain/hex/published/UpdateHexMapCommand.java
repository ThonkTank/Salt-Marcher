package src.domain.hex.published;

public record UpdateHexMapCommand(
        long mapId,
        String displayName,
        int radius,
        boolean confirmDestructiveShrink
) {
}
