package src.view.slotcontent.main.dungeonmap;

final class DungeonMapViewportScale {
    private static final double BASE_GRID = 32.0;
    private static final double DEFAULT_ZOOM = 1.0;
    private static final double MINIMUM_ZOOM = 0.1;
    private static final double MAXIMUM_ZOOM = 4.0;

    private DungeonMapViewportScale() {
    }

    static double baseGrid() {
        return BASE_GRID;
    }

    static double defaultZoom() {
        return DEFAULT_ZOOM;
    }

    static double minimumZoom() {
        return MINIMUM_ZOOM;
    }

    static double maximumZoom() {
        return MAXIMUM_ZOOM;
    }

    static double clampZoom(double value) {
        return Math.max(minimumZoom(), Math.min(maximumZoom(), value));
    }
}
