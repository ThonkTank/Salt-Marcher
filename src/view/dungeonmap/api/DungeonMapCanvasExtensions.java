package src.view.dungeonmap.api;

import src.view.mapcanvas.api.MapCanvasLayers;

public record DungeonMapCanvasExtensions(
        MapCanvasLayers layers
) {

    public DungeonMapCanvasExtensions {
        layers = layers == null ? MapCanvasLayers.empty() : layers;
    }

    public static DungeonMapCanvasExtensions empty() {
        return new DungeonMapCanvasExtensions(MapCanvasLayers.empty());
    }

    public boolean hasContent() {
        return layers.hasContent();
    }
}
