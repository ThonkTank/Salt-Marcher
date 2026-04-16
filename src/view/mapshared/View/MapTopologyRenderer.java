package src.view.mapshared.View;

import javafx.scene.Node;
import src.view.mapshared.Model.MapCellViewModel;
import src.view.mapshared.Model.MapWorkspaceRenderModel;

import java.util.function.Consumer;

/**
 * Topology seam for reusable editor/runtime map rendering.
 */
public interface MapTopologyRenderer {

    Node render(MapWorkspaceRenderModel renderModel, Consumer<MapCellViewModel> onCellSelected);
}
