package src.view.slotcontent.main.dungeonmap;

import java.util.function.Consumer;
import javafx.scene.layout.BorderPane;
import src.view.slotcontent.primitives.mapcanvas.MapCanvasView;

public class DungeonMapView extends BorderPane {

    private final MapCanvasView mapCanvasView = new MapCanvasView();
    private Consumer<DungeonMapViewInputEvent> viewInputEventHandler = ignored -> {};

    public DungeonMapView() {
        setCenter(mapCanvasView);
        mapCanvasView.onViewInputEvent(event -> viewInputEventHandler.accept(new DungeonMapViewInputEvent(event)));
    }

    public void bind(DungeonMapContentModel presentationModel) {
        if (presentationModel == null) {
            return;
        }
        mapCanvasView.bind(presentationModel.mapCanvasContentModel());
    }

    public void onViewInputEvent(Consumer<DungeonMapViewInputEvent> handler) {
        viewInputEventHandler = handler == null ? ignored -> {} : handler;
    }
}
