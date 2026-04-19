package src.view.mapcanvas.View;
import src.view.mapcanvas.api.MapCanvasCell;
import java.util.function.Consumer;
/**
 * Owns raw view-local pointer dispatch for shared cell selections.
 */
final class MapPointerController {
    private Consumer<MapCanvasCell> cellSelectionListener = ignored -> {
    };
    void setCellSelectionListener(Consumer<MapCanvasCell> cellSelectionListener) {
        this.cellSelectionListener = cellSelectionListener == null ? ignored -> {
        } : cellSelectionListener;
    }
    void notifyCellSelected(MapCanvasCell cellViewModel) {
        cellSelectionListener.accept(cellViewModel);
    }
}
