package src.view.mapcanvas.api;

import src.view.mapcanvas.View.MapWorkspaceView;

public final class MapCanvasFactory {

    private MapCanvasFactory() {
    }

    public static MapCanvasHandle create() {
        return create(emptyRenderModel(), MapCanvasCallbacks.none(), MapCanvasLayers.empty());
    }

    public static MapCanvasHandle create(MapCanvasCallbacks callbacks, MapCanvasLayers layers) {
        return create(emptyRenderModel(), callbacks, layers);
    }

    public static MapCanvasHandle create(
            MapCanvasRenderModel renderModel,
            MapCanvasCallbacks callbacks,
            MapCanvasLayers layers
    ) {
        MapCanvasHandle handle = MapCanvasHandle.create(new MapWorkspaceView());
        handle.setCallbacks(callbacks);
        handle.setLayers(layers);
        handle.show(renderModel == null ? emptyRenderModel() : renderModel);
        return handle;
    }

    private static MapCanvasRenderModel emptyRenderModel() {
        return new MapCanvasRenderModel(
                "Dungeon Map",
                "",
                "",
                "",
                "",
                false,
                "",
                MapCanvasScene.empty());
    }
}
