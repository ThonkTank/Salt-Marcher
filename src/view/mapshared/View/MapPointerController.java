package src.view.mapshared.View;
import src.view.mapshared.ViewModel.MapCellViewModel;
import java.util.function.Consumer;
/**
 * Owns raw view-local pointer dispatch for shared cell selections.
 */
final class MapPointerController {
    private Consumer<MapCellViewModel> cellSelectionListener = ignored -> {
    };
    public void setCellSelectionListener(Consumer<MapCellViewModel> cellSelectionListener) {
        this.cellSelectionListener = cellSelectionListener == null ? ignored -> {
        } : cellSelectionListener;
    }
    public void notifyCellSelected(MapCellViewModel cellViewModel) {
        cellSelectionListener.accept(cellViewModel);
    }
}
