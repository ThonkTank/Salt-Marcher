package features.hex.api;

public record UpdateHexMapCommand(
        long mapId,
        String displayName,
        int radius,
        boolean confirmDestructiveShrink
) {
}
