package src.view.mapshared.View;

import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.control.Label;
import javafx.scene.layout.StackPane;
import org.jspecify.annotations.Nullable;
import src.view.mapshared.Model.MapCellViewModel;

import java.util.function.Consumer;

final class SquareMapCellFactory {

    private final SquareMapLayoutMetrics layout;

    SquareMapCellFactory(SquareMapLayoutMetrics layout) {
        this.layout = layout;
    }

    Node create(@Nullable MapCellViewModel snapshot, int q, int r, Consumer<MapCellViewModel> onCellSelected) {
        StackPane cell = new StackPane();
        cell.getStyleClass().add("dungeon-map-cell");
        cell.relocate(layout.originX(q), layout.originY(r));
        cell.setMinSize(layout.cellSize(), layout.cellSize());
        cell.setPrefSize(layout.cellSize(), layout.cellSize());
        cell.setMaxSize(layout.cellSize(), layout.cellSize());
        applyCellStyleClass(cell, snapshot);
        Label glyph = new Label(cellText(snapshot));
        glyph.getStyleClass().add("dungeon-map-cell-glyph");
        Label caption = new Label(cellCaption(snapshot));
        caption.getStyleClass().add("dungeon-map-cell-caption");
        caption.setWrapText(true);
        cell.getChildren().addAll(glyph, caption);
        StackPane.setAlignment(glyph, Pos.TOP_LEFT);
        StackPane.setAlignment(caption, Pos.BOTTOM_LEFT);
        configureSelection(cell, snapshot, onCellSelected);
        return cell;
    }

    private void configureSelection(StackPane cell, @Nullable MapCellViewModel snapshot, Consumer<MapCellViewModel> onCellSelected) {
        if (snapshot == null) {
            cell.setDisable(true);
            return;
        }
        if (snapshot.current()) {
            cell.setOnMouseClicked(event -> onCellSelected.accept(snapshot));
            return;
        }
        cell.setOnMouseClicked(event -> {
            if (snapshot.interactive()) {
                onCellSelected.accept(snapshot);
            }
        });
        cell.setDisable(!snapshot.interactive());
    }

    private void applyCellStyleClass(StackPane cell, @Nullable MapCellViewModel snapshot) {
        cell.getStyleClass().removeAll(
                "dungeon-map-cell-empty",
                "dungeon-map-cell-current",
                "dungeon-map-cell-room",
                "dungeon-map-cell-corridor",
                "dungeon-map-cell-blocked",
                "dungeon-map-cell-open");
        if (snapshot == null) {
            cell.getStyleClass().add("dungeon-map-cell-empty");
            return;
        }
        if (snapshot.current()) {
            cell.getStyleClass().add("dungeon-map-cell-current");
            return;
        }
        if (snapshot.room()) {
            cell.getStyleClass().add("dungeon-map-cell-room");
            return;
        }
        if (snapshot.corridor()) {
            cell.getStyleClass().add("dungeon-map-cell-corridor");
            return;
        }
        if (snapshot.blocked()) {
            cell.getStyleClass().add("dungeon-map-cell-blocked");
            return;
        }
        cell.getStyleClass().add("dungeon-map-cell-open");
    }

    private String cellText(@Nullable MapCellViewModel snapshot) {
        if (snapshot == null) {
            return "";
        }
        if (snapshot.current()) {
            return "@";
        }
        if (snapshot.room()) {
            return "RM";
        }
        if (snapshot.corridor()) {
            return "CR";
        }
        return "...";
    }

    private String cellCaption(@Nullable MapCellViewModel snapshot) {
        if (snapshot == null || snapshot.label() == null || snapshot.label().isBlank()) {
            return "";
        }
        if (snapshot.label().length() <= 10) {
            return snapshot.label();
        }
        return snapshot.label().substring(0, 10);
    }
}
