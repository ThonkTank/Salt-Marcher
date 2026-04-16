package src.view.mapshared.Controller;

import src.view.mapshared.Model.MapCellViewModel;

import java.util.function.Consumer;

/**
 * Owns raw view-local pointer dispatch for shared cell selections.
 */
public final class MapPointerController {

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
