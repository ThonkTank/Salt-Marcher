package src.view.mapshared.View;
interface MapWorkspaceInteractionCallbacks {
    void onPrimaryClick(double canvasX, double canvasY);
    void onViewportChanged();
    void onViewportGeometryChanged();
    void onFloorStep(int delta);
    boolean mapLoaded();
    MapWorkspaceCanvasMetrics canvasMetrics();
}
