package src.view.leftbartabs.hexmap;

public record HexMapControlsViewInputEvent(
        boolean createMapRequested,
        boolean selectMapRequested,
        boolean updateMapRequested,
        boolean saveMarkerRequested,
        long mapId,
        String mapName,
        int mapRadius,
        boolean confirmDestructiveShrink,
        String toolKey,
        String terrainKey,
        boolean tileSelected,
        int q,
        int r,
        long markerId,
        String markerName,
        String markerTypeKey,
        String markerNote
) {
}
