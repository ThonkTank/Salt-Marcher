package src.view.leftbartabs.hexmap;

public record HexMapStateViewInputEvent(
        boolean updateMapRequested,
        boolean saveMarkerRequested,
        String mapName,
        String mapRadius,
        boolean confirmDestructiveShrink,
        int markerOptionIndex,
        boolean markerSelectionRequested,
        String markerName,
        int markerTypeOptionIndex,
        String markerNote
) {
    public HexMapStateViewInputEvent {
        mapName = mapName == null ? "" : mapName;
        mapRadius = mapRadius == null ? "" : mapRadius;
        markerOptionIndex = Math.max(-1, markerOptionIndex);
        markerName = markerName == null ? "" : markerName;
        markerTypeOptionIndex = Math.max(-1, markerTypeOptionIndex);
        markerNote = markerNote == null ? "" : markerNote;
    }
}
