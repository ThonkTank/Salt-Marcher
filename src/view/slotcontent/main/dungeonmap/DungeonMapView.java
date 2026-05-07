package src.view.slotcontent.main.dungeonmap;

import src.view.slotcontent.primitives.mapcanvas.MapCanvasView;

public class DungeonMapView extends MapCanvasView {

    public void bind(DungeonMapContentModel presentationModel) {
        if (presentationModel == null) {
            return;
        }
        renderSceneProperty().unbind();
        renderSceneProperty().bind(presentationModel.renderSceneProperty());
    }
}
