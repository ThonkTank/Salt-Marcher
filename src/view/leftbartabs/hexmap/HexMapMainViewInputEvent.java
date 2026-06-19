package src.view.leftbartabs.hexmap;

public record HexMapMainViewInputEvent(
        long mapId,
        int q,
        int r,
        String activeToolKey,
        String activeTerrainKey
) {
}
