package src.view.mapshared.View;

import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.layout.GridPane;
import src.view.mapshared.Model.MapCellViewModel;
import src.view.mapshared.Model.MapWorkspaceRenderModel;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.function.Consumer;

/**
 * Square-grid renderer used by the initial dungeon skeleton.
 */
public final class SquareMapTopologyRenderer implements MapTopologyRenderer {

    @Override
    public Node render(MapWorkspaceRenderModel renderModel, Consumer<MapCellViewModel> onCellSelected) {
        GridPane grid = new GridPane();
        grid.setHgap(6);
        grid.setVgap(6);
        grid.setPadding(new Insets(12));
        grid.setAlignment(Pos.CENTER_LEFT);

        Map<String, MapCellViewModel> cellsByKey = new LinkedHashMap<>();
        for (MapCellViewModel cell : renderModel.cells()) {
            cellsByKey.put(key(cell.q(), cell.r()), cell);
        }

        for (int r = 0; r < renderModel.height(); r++) {
            for (int q = 0; q < renderModel.width(); q++) {
                MapCellViewModel snapshot = cellsByKey.get(key(q, r));
                Button cellButton = new Button(cellText(snapshot));
                cellButton.setMinSize(48, 48);
                cellButton.setPrefSize(48, 48);
                cellButton.getStyleClass().add("compact");
                styleCell(cellButton, snapshot);
                cellButton.setDisable(snapshot == null || !snapshot.interactive());
                cellButton.setOnAction(event -> onCellSelected.accept(snapshot));
                grid.add(cellButton, q, r);
            }
        }
        return grid;
    }

    private String cellText(MapCellViewModel snapshot) {
        if (snapshot == null) {
            return "";
        }
        if (snapshot.current()) {
            return "@";
        }
        if (snapshot.room()) {
            return "R";
        }
        if (snapshot.corridor()) {
            return "C";
        }
        return ".";
    }

    private void styleCell(Button cellButton, MapCellViewModel snapshot) {
        String style = "-fx-font-size: 14px; -fx-font-weight: bold;";
        if (snapshot == null) {
            style += "-fx-background-color: rgba(255,255,255,0.04);";
        } else if (snapshot.current()) {
            style += "-fx-background-color: #cfa23a; -fx-text-fill: black; -fx-border-color: white; -fx-border-width: 2px;";
        } else if (snapshot.room()) {
            style += "-fx-background-color: #406b5b; -fx-text-fill: white;";
        } else if (snapshot.corridor()) {
            style += "-fx-background-color: #4c5568; -fx-text-fill: white;";
        } else if (snapshot.blocked()) {
            style += "-fx-background-color: #3a3a3a; -fx-text-fill: white;";
        } else {
            style += "-fx-background-color: #5f7089; -fx-text-fill: white;";
        }
        cellButton.setStyle(style);
    }

    private String key(int q, int r) {
        return q + ":" + r;
    }
}
