package src.view.mapshared.View;

import javafx.scene.Node;
import src.view.mapshared.Model.MapViewport;
import src.view.mapshared.Model.MapWorkspaceRenderModel;

/**
 * Topology seam for reusable editor/runtime map rendering.
 */
public interface MapTopologyRenderer {

    Node render(MapWorkspaceRenderModel renderModel, MapViewport viewport);
}
