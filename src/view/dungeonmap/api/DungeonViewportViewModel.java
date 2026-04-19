package src.view.dungeonmap.api;

public record DungeonViewportViewModel(
        double centerX,
        double centerY,
        double canvasWidth,
        double canvasHeight,
        double zoom
) {
    public DungeonViewportViewModel {
        canvasWidth = Math.max(1.0, canvasWidth);
        canvasHeight = Math.max(1.0, canvasHeight);
        zoom = Math.max(0.1, zoom);
    }
}
