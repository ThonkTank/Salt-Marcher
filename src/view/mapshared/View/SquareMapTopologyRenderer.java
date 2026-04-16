package src.view.mapshared.View;

import javafx.scene.Node;
import javafx.scene.control.Label;
import javafx.scene.layout.Pane;
import javafx.scene.layout.Region;
import javafx.scene.layout.StackPane;
import javafx.scene.shape.Line;
import src.view.mapshared.Model.MapCellViewModel;
import src.view.mapshared.Model.MapEdgeViewModel;
import src.view.mapshared.Model.MapWorkspaceRenderModel;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.function.Consumer;

/**
 * Square-grid renderer used by the initial dungeon skeleton.
 */
public final class SquareMapTopologyRenderer implements MapTopologyRenderer {

    private static final double CELL_SIZE = 58.0;
    private static final double GAP = 10.0;
    private static final double PADDING = 28.0;

    @Override
    public Node render(MapWorkspaceRenderModel renderModel, Consumer<MapCellViewModel> onCellSelected) {
        Pane scene = new Pane();
        scene.getStyleClass().add("dungeon-map-scene");
        double width = PADDING * 2 + renderModel.width() * CELL_SIZE + Math.max(0, renderModel.width() - 1) * GAP;
        double height = PADDING * 2 + renderModel.height() * CELL_SIZE + Math.max(0, renderModel.height() - 1) * GAP;
        scene.setMinSize(width, height);
        scene.setPrefSize(width, height);
        scene.setMaxSize(Region.USE_PREF_SIZE, Region.USE_PREF_SIZE);

        Map<String, MapCellViewModel> cellsByKey = new LinkedHashMap<>();
        for (MapCellViewModel cell : renderModel.cells()) {
            cellsByKey.put(key(cell.q(), cell.r()), cell);
        }

        paintGrid(scene, renderModel.width(), renderModel.height());
        paintEdges(scene, renderModel.edges());

        for (int r = 0; r < renderModel.height(); r++) {
            for (int q = 0; q < renderModel.width(); q++) {
                MapCellViewModel snapshot = cellsByKey.get(key(q, r));
                scene.getChildren().add(createCellNode(snapshot, q, r, onCellSelected));
            }
        }
        return scene;
    }

    private void paintGrid(Pane scene, int width, int height) {
        for (int column = 0; column <= width; column++) {
            double x = PADDING + column * (CELL_SIZE + GAP) - GAP / 2.0;
            Line line = new Line(x, PADDING - GAP / 2.0, x, scene.getPrefHeight() - PADDING + GAP / 2.0);
            line.getStyleClass().add("dungeon-map-grid-line");
            scene.getChildren().add(line);
        }
        for (int row = 0; row <= height; row++) {
            double y = PADDING + row * (CELL_SIZE + GAP) - GAP / 2.0;
            Line line = new Line(PADDING - GAP / 2.0, y, scene.getPrefWidth() - PADDING + GAP / 2.0, y);
            line.getStyleClass().add("dungeon-map-grid-line");
            scene.getChildren().add(line);
        }
    }

    private void paintEdges(Pane scene, Iterable<MapEdgeViewModel> edges) {
        for (MapEdgeViewModel edge : edges) {
            Line line = new Line(
                    centerX(edge.fromQ()),
                    centerY(edge.fromR()),
                    centerX(edge.toQ()),
                    centerY(edge.toR()));
            line.getStyleClass().add("door".equals(edge.kind()) ? "dungeon-map-door" : "dungeon-map-wall");
            scene.getChildren().add(line);

            if (!edge.label().isBlank()) {
                Label marker = new Label("door".equals(edge.kind()) ? "D" : "");
                marker.getStyleClass().add("door".equals(edge.kind()) ? "dungeon-map-door-marker" : "dungeon-map-wall-marker");
                marker.relocate((centerX(edge.fromQ()) + centerX(edge.toQ())) / 2.0 - 11.0,
                        (centerY(edge.fromR()) + centerY(edge.toR())) / 2.0 - 11.0);
                scene.getChildren().add(marker);
            }
        }
    }

    private Node createCellNode(MapCellViewModel snapshot, int q, int r, Consumer<MapCellViewModel> onCellSelected) {
        StackPane cell = new StackPane();
        cell.getStyleClass().add("dungeon-map-cell");
        cell.relocate(originX(q), originY(r));
        cell.setMinSize(CELL_SIZE, CELL_SIZE);
        cell.setPrefSize(CELL_SIZE, CELL_SIZE);
        cell.setMaxSize(CELL_SIZE, CELL_SIZE);
        applyCellStyleClass(cell, snapshot);
        Label glyph = new Label(cellText(snapshot));
        glyph.getStyleClass().add("dungeon-map-cell-glyph");
        Label caption = new Label(cellCaption(snapshot));
        caption.getStyleClass().add("dungeon-map-cell-caption");
        caption.setWrapText(true);
        cell.getChildren().addAll(glyph, caption);
        StackPane.setAlignment(glyph, javafx.geometry.Pos.TOP_LEFT);
        StackPane.setAlignment(caption, javafx.geometry.Pos.BOTTOM_LEFT);

        if (snapshot == null) {
            cell.setDisable(true);
        } else if (snapshot.current()) {
            cell.setOnMouseClicked(event -> onCellSelected.accept(snapshot));
        } else {
            cell.setOnMouseClicked(event -> {
                if (snapshot.interactive()) {
                    onCellSelected.accept(snapshot);
                }
            });
            cell.setDisable(!snapshot.interactive());
        }
        return cell;
    }

    private void applyCellStyleClass(StackPane cell, MapCellViewModel snapshot) {
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

    private String cellText(MapCellViewModel snapshot) {
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

    private String cellCaption(MapCellViewModel snapshot) {
        if (snapshot == null || snapshot.label() == null || snapshot.label().isBlank()) {
            return "";
        }
        if (snapshot.label().length() <= 10) {
            return snapshot.label();
        }
        return snapshot.label().substring(0, 10);
    }

    private double originX(int q) {
        return PADDING + q * (CELL_SIZE + GAP);
    }

    private double originY(int r) {
        return PADDING + r * (CELL_SIZE + GAP);
    }

    private double centerX(int q) {
        return originX(q) + CELL_SIZE / 2.0;
    }

    private double centerY(int r) {
        return originY(r) + CELL_SIZE / 2.0;
    }

    private String key(int q, int r) {
        return q + ":" + r;
    }
}
