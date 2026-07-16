package features.hex.api;

public record RenameHexMapCommand(
        long mapId,
        String displayName
) {
}
