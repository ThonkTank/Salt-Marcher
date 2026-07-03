package src.view.leftbartabs.hexmap;

public record HexMapControlsViewInputEvent(
        int toolOptionIndex,
        int terrainOptionIndex
) {
    public HexMapControlsViewInputEvent {
        toolOptionIndex = Math.max(-1, toolOptionIndex);
        terrainOptionIndex = Math.max(-1, terrainOptionIndex);
    }
}
