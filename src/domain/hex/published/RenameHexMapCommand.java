package src.domain.hex.published;

public record RenameHexMapCommand(
        long mapId,
        String displayName
) {
}
